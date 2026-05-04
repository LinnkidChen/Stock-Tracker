import { GET } from './route';
import {
  consumeWebSocketUpgradeRateLimit,
  getWebSocketMaxSymbols
} from '@/lib/rate-limit';

jest.mock('@/lib/rate-limit', () => ({
  consumeWebSocketUpgradeRateLimit: jest.fn(),
  getWebSocketMaxSymbols: jest.fn(),
  toRateLimitError: jest.fn((result) => result.error)
}));

class MockResponse {
  body: BodyInit | null;
  status: number;
  webSocket?: unknown;
  headers: Headers;

  constructor(
    body: BodyInit | null,
    init: ResponseInit & { webSocket?: unknown } = {}
  ) {
    this.body = body;
    this.status = init.status ?? 200;
    this.webSocket = init.webSocket;
    this.headers = new Headers(init.headers);
  }

  async text() {
    return String(this.body ?? '');
  }
}

class MockSocket {
  accepted = false;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: any) => void>>();

  accept() {
    this.accepted = true;
  }

  send(data: string) {
    this.sent.push(data);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: any = {}) {
    (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
  }

  message(data: unknown) {
    this.dispatch('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });
  }

  close() {
    this.dispatch('close');
  }

  sentMessages() {
    return this.sent.map((message) => JSON.parse(message));
  }
}

type MockPair = {
  client: MockSocket;
  server: MockSocket;
};

const originalResponse = global.Response;
const originalWebSocketPair = (globalThis as any).WebSocketPair;
const originalFetch = global.fetch;
let currentPair: MockPair | null = null;
const mockConsumeWebSocketUpgradeRateLimit =
  consumeWebSocketUpgradeRateLimit as jest.MockedFunction<
    typeof consumeWebSocketUpgradeRateLimit
  >;
const mockGetWebSocketMaxSymbols =
  getWebSocketMaxSymbols as jest.MockedFunction<typeof getWebSocketMaxSymbols>;

function createWebSocketRequest(
  url = 'http://localhost/api/ws/prices',
  headers: Record<string, string> = {}
) {
  return createMockRequest(url, 'websocket', headers);
}

function createMockRequest(
  url: string,
  upgrade: string | null = null,
  headers: Record<string, string> = {}
): Request {
  const requestHeaders = new Headers(headers);
  if (upgrade) {
    requestHeaders.set('upgrade', upgrade);
  }

  return {
    url,
    headers: requestHeaders
  } as unknown as Request;
}

function mockQuoteResponse(options: {
  ok?: boolean;
  status?: number;
  retryAfter?: string;
  price?: number;
  symbol?: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  const {
    ok = true,
    status = ok ? 200 : 500,
    retryAfter,
    price = 123.45,
    symbol = 'AAPL',
    errorCode = 'UNKNOWN_ERROR',
    errorMessage = 'Quote failed'
  } = options;

  return {
    ok,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'retry-after' ? retryAfter : null
    },
    json: async () =>
      ok
        ? {
            success: true,
            data: {
              symbol,
              name: symbol,
              price,
              change: 1.25,
              changePercent: 1.02,
              volume: 1000,
              high: price + 1,
              low: price - 1,
              open: price - 0.5,
              previousClose: price - 1.25,
              marketCap: null,
              peRatio: null,
              eps: null,
              dividendYield: null,
              week52High: null,
              week52Low: null,
              avgVolume: null,
              beta: null,
              lastUpdated: '2024-01-01T00:00:00.000Z'
            }
          }
        : {
            success: false,
            data: null,
            error: {
              code: errorCode,
              message: errorMessage,
              details: retryAfter ? { retryAfter: Number(retryAfter) } : {}
            }
          }
  } as unknown as Response;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForAsync(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await flushPromises();
  }

  throw new Error('Timed out waiting for async condition');
}

describe('/api/ws/prices', () => {
  beforeAll(() => {
    global.Response = MockResponse as any;
    (globalThis as any).WebSocketPair = function WebSocketPair() {
      currentPair = {
        client: new MockSocket(),
        server: new MockSocket()
      };

      return [currentPair.client, currentPair.server];
    };
  });

  beforeEach(() => {
    jest.useFakeTimers();
    currentPair = null;
    mockConsumeWebSocketUpgradeRateLimit.mockResolvedValue({
      allowed: true,
      degraded: false,
      policy: 'webSocketUpgrades',
      scope: 'websocket-upgrade',
      subject: { type: 'ip', id: '127.0.0.1' },
      source: 'upstash'
    });
    mockGetWebSocketMaxSymbols.mockReturnValue(30);
    global.fetch = jest.fn(async () => mockQuoteResponse({})) as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.Response = originalResponse;
    (globalThis as any).WebSocketPair = originalWebSocketPair;
  });

  it('rejects non-websocket requests', async () => {
    const response = await GET(
      createMockRequest('http://localhost/api/ws/prices')
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Expected websocket');
  });

  it('returns 429 when the websocket upgrade limiter denies the request', async () => {
    mockConsumeWebSocketUpgradeRateLimit.mockResolvedValueOnce({
      allowed: false,
      degraded: false,
      policy: 'webSocketUpgrades',
      scope: 'websocket-upgrade',
      subject: { type: 'ip', id: '127.0.0.1' },
      source: 'upstash',
      limit: 30,
      remaining: 0,
      reset: 6000,
      retryAfter: 5,
      headers: {
        'Retry-After': '5',
        'RateLimit-Limit': '30',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '6'
      },
      error: {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please try again later.',
        details: { retryAfter: 5 }
      }
    });

    const response = await GET(createWebSocketRequest());
    const body = JSON.parse(await response.text());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(body.error.code).toBe('API_LIMIT_EXCEEDED');
    expect(currentPair).toBeNull();
  });

  it('subscribes and sends provider-backed price updates', async () => {
    global.fetch = jest.fn(async () =>
      mockQuoteResponse({ price: 150.25, symbol: 'AAPL.US' })
    ) as any;

    const response = await GET(
      createWebSocketRequest(
        'http://localhost/api/ws/prices?provider=longbridge'
      )
    );

    expect(response.status).toBe(101);
    expect((response as any).webSocket).toBe(currentPair?.client);
    expect(currentPair?.server.accepted).toBe(true);

    currentPair!.server.message({ type: 'subscribe', symbol: 'aapl' });
    await waitForAsync(() => currentPair!.server.sentMessages().length > 1);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost/api/stocks/quote/AAPL?provider=longbridge',
      { cache: 'no-store' }
    );
    expect(currentPair!.server.sentMessages()).toEqual(
      expect.arrayContaining([
        { type: 'subscribed', symbol: 'AAPL' },
        expect.objectContaining({
          type: 'price_update',
          symbol: 'AAPL',
          price: 150.25,
          change: 1.25,
          changePercent: 1.02,
          volume: 1000,
          provider: 'longbridge',
          lastUpdated: '2024-01-01T00:00:00.000Z'
        })
      ])
    );
  });

  it('forwards safe client identity headers to the internal quote fetch', async () => {
    await GET(
      createWebSocketRequest('http://localhost/api/ws/prices', {
        'x-forwarded-for': '203.0.113.10',
        cookie: 'session=abc',
        authorization: 'Bearer token'
      })
    );

    currentPair!.server.message({ type: 'subscribe', symbol: 'AAPL' });
    await waitForAsync(() => currentPair!.server.sentMessages().length > 1);

    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;

    expect(headers.get('x-forwarded-for')).toBe('203.0.113.10');
    expect(headers.get('cookie')).toBe('session=abc');
    expect(headers.get('authorization')).toBe('Bearer token');
  });

  it('rejects subscriptions above the per-connection symbol cap', async () => {
    mockGetWebSocketMaxSymbols.mockReturnValue(1);

    await GET(createWebSocketRequest());

    currentPair!.server.message({ type: 'subscribe', symbol: 'AAPL' });
    currentPair!.server.message({ type: 'subscribe', symbol: 'MSFT' });
    await flushPromises();

    expect(currentPair!.server.sentMessages()).toEqual(
      expect.arrayContaining([
        { type: 'subscribed', symbol: 'AAPL' },
        expect.objectContaining({
          type: 'error',
          symbol: 'MSFT',
          code: 'API_LIMIT_EXCEEDED'
        })
      ])
    );
  });

  it('sends upstream errors and respects Retry-After before polling again', async () => {
    global.fetch = jest.fn(async () =>
      mockQuoteResponse({
        ok: false,
        status: 429,
        retryAfter: '6',
        errorCode: 'API_LIMIT_EXCEEDED',
        errorMessage: 'Rate limit'
      })
    ) as any;

    await GET(createWebSocketRequest());

    currentPair!.server.message({ type: 'subscribe', symbol: 'AAPL' });
    await waitForAsync(() => currentPair!.server.sentMessages().length > 1);

    expect(currentPair!.server.sentMessages()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          symbol: 'AAPL',
          code: 'API_LIMIT_EXCEEDED',
          message: 'Rate limit',
          retryAfter: 6
        })
      ])
    );

    await jest.advanceTimersByTimeAsync(4999);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and stops polling when no symbols remain', async () => {
    await GET(createWebSocketRequest());

    currentPair!.server.message({ type: 'subscribe', symbol: 'AAPL' });
    await waitForAsync(() => currentPair!.server.sentMessages().length > 1);

    currentPair!.server.message({ type: 'unsubscribe', symbol: 'AAPL' });
    await flushPromises();
    await jest.advanceTimersByTimeAsync(5000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(currentPair!.server.sentMessages()).toEqual(
      expect.arrayContaining([{ type: 'unsubscribed', symbol: 'AAPL' }])
    );
  });

  it('responds to ping and invalid JSON messages', async () => {
    await GET(createWebSocketRequest());

    currentPair!.server.message({ type: 'ping' });
    currentPair!.server.message('{bad-json');

    expect(currentPair!.server.sentMessages()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'pong' }),
        { type: 'error', message: 'Invalid message' }
      ])
    );
  });
});
