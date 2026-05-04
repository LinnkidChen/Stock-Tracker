import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import {
  consumeWebSocketUpgradeRateLimit,
  getWebSocketMaxSymbols,
  toRateLimitError
} from '@/lib/rate-limit';
import { APIResponse, StockQuote } from '@/lib/types/stock-api';

const POLL_INTERVAL_MS = 5000;
const FORWARDED_QUOTE_HEADERS = [
  'authorization',
  'cookie',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip'
] as const;

type PriceUpdateMessage = {
  type: 'price_update';
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  previousClose: number;
  avgVolume: number | null;
  ts: number;
  lastUpdated: string;
  provider: string;
};

type PriceFetchResult =
  | {
      ok: true;
      message: PriceUpdateMessage;
    }
  | {
      ok: false;
      symbol: string;
      message: string;
      code?: string;
      retryAfter?: number;
    };

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 400 });
  }

  const rateLimit = await consumeWebSocketUpgradeRateLimit(request);
  if (!rateLimit.allowed) {
    const error = rateLimit.error ?? toRateLimitError(rateLimit);

    return createJsonResponse(
      {
        success: false,
        data: null,
        error,
        timestamp: new Date().toISOString()
      },
      {
        status: 429,
        headers: rateLimit.headers
      }
    );
  }

  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  const requestUrl = new URL(request.url);
  const provider =
    requestUrl.searchParams.get('provider') || CANONICAL_QUOTE_PROVIDER;
  const quoteFetchHeaders = createForwardedQuoteHeaders(request);
  const maxSymbols = getWebSocketMaxSymbols();

  const subs = new Set<string>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollInFlight = false;
  let pollRequested = false;
  let nextAllowedAt = 0;

  server.accept();

  function safeSend(payload: unknown) {
    try {
      server.send(JSON.stringify(payload));
    } catch {
      // The client may disconnect between a provider response and send.
    }
  }

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll(delayMs: number = POLL_INTERVAL_MS) {
    if (subs.size === 0 || pollTimer) return;

    pollTimer = setTimeout(
      () => {
        pollTimer = null;
        void pollOnce();
      },
      Math.max(0, delayMs)
    );
  }

  function triggerPoll() {
    clearPollTimer();
    void pollOnce();
  }

  async function pollOnce() {
    if (pollInFlight) {
      pollRequested = true;
      return;
    }

    if (subs.size === 0) return;

    const now = Date.now();
    if (now < nextAllowedAt) {
      schedulePoll(nextAllowedAt - now);
      return;
    }

    pollInFlight = true;

    try {
      for (const symbol of Array.from(subs)) {
        if (!subs.has(symbol)) continue;

        const result = await fetchPriceUpdate(
          requestUrl,
          symbol,
          provider,
          quoteFetchHeaders
        );

        if (result.ok) {
          safeSend(result.message);
          continue;
        }

        safeSend({
          type: 'error',
          symbol: result.symbol,
          message: result.message,
          code: result.code,
          retryAfter: result.retryAfter
        });

        if (result.retryAfter) {
          nextAllowedAt = Date.now() + result.retryAfter * 1000;
          break;
        }
      }
    } finally {
      pollInFlight = false;

      if (subs.size > 0) {
        if (pollRequested) {
          pollRequested = false;
          schedulePoll(Math.max(0, nextAllowedAt - Date.now()));
        } else {
          schedulePoll(Math.max(POLL_INTERVAL_MS, nextAllowedAt - Date.now()));
        }
      }
    }
  }

  server.addEventListener('message', (event: any) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg?.type === 'subscribe' && typeof msg.symbol === 'string') {
        const symbol = normalizeSymbol(msg.symbol);
        if (!subs.has(symbol) && subs.size >= maxSymbols) {
          safeSend({
            type: 'error',
            symbol,
            code: 'API_LIMIT_EXCEEDED',
            message: `WebSocket subscription limit exceeded. Maximum ${maxSymbols} symbols per connection.`
          });
          return;
        }

        subs.add(symbol);
        safeSend({ type: 'subscribed', symbol });
        triggerPoll();
      } else if (
        msg?.type === 'unsubscribe' &&
        typeof msg.symbol === 'string'
      ) {
        const symbol = normalizeSymbol(msg.symbol);
        subs.delete(symbol);
        if (subs.size === 0) clearPollTimer();
        safeSend({ type: 'unsubscribed', symbol });
      } else if (msg?.type === 'ping') {
        safeSend({ type: 'pong', ts: Date.now() });
      }
    } catch {
      safeSend({ type: 'error', message: 'Invalid message' });
    }
  });

  server.addEventListener('close', () => {
    subs.clear();
    clearPollTimer();
  });

  return new Response(null, { status: 101, webSocket: client } as any);
}

async function fetchPriceUpdate(
  requestUrl: URL,
  symbol: string,
  provider: string,
  forwardedHeaders: Headers | undefined
): Promise<PriceFetchResult> {
  const quoteUrl = new URL(
    `/api/stocks/quote/${encodeURIComponent(symbol)}`,
    requestUrl
  );
  quoteUrl.searchParams.set('provider', provider);

  try {
    const requestInit: RequestInit = { cache: 'no-store' };
    if (forwardedHeaders) {
      requestInit.headers = forwardedHeaders;
    }

    const response = await fetch(quoteUrl.toString(), requestInit);
    const apiResponse = await readAPIResponse<StockQuote>(response);

    if (!response.ok || !apiResponse?.success || !apiResponse.data) {
      return {
        ok: false,
        symbol,
        message:
          apiResponse?.error?.message || `Failed to fetch quote for ${symbol}`,
        code: apiResponse?.error?.code,
        retryAfter: getRetryAfter(response, apiResponse)
      };
    }

    const quote = apiResponse.data;
    const ts = Date.now();

    return {
      ok: true,
      message: {
        type: 'price_update',
        symbol,
        price: Number(quote.price),
        change: Number(quote.change),
        changePercent: Number(quote.changePercent),
        volume: Number(quote.volume),
        open: Number(quote.open),
        previousClose: Number(quote.previousClose),
        avgVolume: quote.avgVolume === null ? null : Number(quote.avgVolume),
        ts,
        lastUpdated: quote.lastUpdated || new Date(ts).toISOString(),
        provider
      }
    };
  } catch (error) {
    return {
      ok: false,
      symbol,
      message: error instanceof Error ? error.message : 'Quote stream failed'
    };
  }
}

function createJsonResponse(payload: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers
  });
}

function createForwardedQuoteHeaders(request: Request): Headers | undefined {
  const headers = new Headers();

  FORWARDED_QUOTE_HEADERS.forEach((header) => {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  return Array.from(headers.keys()).length > 0 ? headers : undefined;
}

async function readAPIResponse<T>(
  response: Response
): Promise<APIResponse<T> | null> {
  try {
    return (await response.json()) as APIResponse<T>;
  } catch {
    return null;
  }
}

function getRetryAfter(
  response: Response,
  apiResponse: APIResponse<unknown> | null
): number | undefined {
  const retryAfter =
    parseRetryAfter(response.headers.get('Retry-After')) ??
    parseRetryAfter(apiResponse?.error?.details?.retryAfter);

  return retryAfter && retryAfter > 0 ? retryAfter : undefined;
}

function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.ceil(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return Math.ceil(numericValue);
  }

  const dateValue = Date.parse(value);
  if (!Number.isNaN(dateValue)) {
    return Math.ceil((dateValue - Date.now()) / 1000);
  }

  return undefined;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
