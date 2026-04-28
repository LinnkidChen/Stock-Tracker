import {
  APIError,
  DEFAULT_KLINE_INTERVAL,
  type KLineInterval,
  KLineCandle,
  KLineSeries,
  StockQuote,
  TimeRange
} from '../types/stock-api';
import {
  ProviderCapabilities,
  ProviderHealthCheck,
  StockDataProvider
} from './types';
import { YAHOO_QUOTE_PROVIDER } from './config';

const YAHOO_CHART_BASE_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_HEALTH_SYMBOL = 'AAPL';

const YAHOO_KLINE_PARAMS: Record<
  KLineInterval,
  { range: string; interval: string; aggregateByYear?: boolean }
> = {
  day: { range: '2y', interval: '1d' },
  week: { range: '5y', interval: '1wk' },
  month: { range: '10y', interval: '1mo' },
  year: { range: 'max', interval: '1mo', aggregateByYear: true }
};

export const YAHOO_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  quotes: true,
  kLines: true,
  realtime: 'polling',
  intervals: ['day', 'week', 'month', 'year'],
  markets: ['US', 'HK', 'CN', 'GLOBAL'],
  requiresCredentials: false
};

interface YahooProviderOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  healthSymbol?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: YahooChartError | null;
  };
}

interface YahooChartError {
  code?: string;
  description?: string;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: YahooQuoteIndicator[];
  };
}

interface YahooChartMeta {
  symbol?: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooQuoteIndicator {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
}

interface YahooChartFetchResult {
  result: YahooChartResult;
  yahooSymbol: string;
}

export class YahooFinanceProvider implements StockDataProvider {
  id = YAHOO_QUOTE_PROVIDER;
  name = 'Yahoo Finance';
  capabilities = YAHOO_PROVIDER_CAPABILITIES;

  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly healthSymbol: string;

  constructor(options: YahooProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.healthSymbol = options.healthSymbol ?? YAHOO_HEALTH_SYMBOL;
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    const { result } = await this.fetchChart(symbol, {
      range: '5d',
      interval: '1d'
    });
    const meta = result.meta ?? {};
    const quote = result.indicators?.quote?.[0] ?? {};
    const latestIndex = getLatestIndex(quote.close);
    const price = firstNumber(
      meta.regularMarketPrice,
      getArrayNumber(quote.close, latestIndex)
    );
    const previousClose = firstNumber(
      meta.previousClose,
      meta.chartPreviousClose,
      getPreviousNumber(quote.close, latestIndex)
    );

    if (price === undefined || previousClose === undefined) {
      throw {
        code: 'INVALID_SYMBOL',
        message: `Yahoo Finance quote data was unavailable for ${symbol}`,
        details: {
          provider: this.id
        }
      } as APIError;
    }

    const change = price - previousClose;
    const timestampSeconds = firstNumber(
      meta.regularMarketTime,
      getArrayNumber(result.timestamp, latestIndex)
    );
    const lastUpdated = timestampSeconds
      ? new Date(timestampSeconds * 1000).toISOString()
      : new Date(this.now()).toISOString();

    return {
      symbol: normalizeSymbol(symbol),
      name: meta.longName ?? meta.shortName ?? normalizeSymbol(symbol),
      price,
      change,
      changePercent: previousClose !== 0 ? (change / previousClose) * 100 : 0,
      volume: firstNumber(
        meta.regularMarketVolume,
        getArrayNumber(quote.volume, latestIndex),
        0
      )!,
      high: firstNumber(
        meta.regularMarketDayHigh,
        getArrayNumber(quote.high, latestIndex),
        price
      )!,
      low: firstNumber(
        meta.regularMarketDayLow,
        getArrayNumber(quote.low, latestIndex),
        price
      )!,
      open: firstNumber(
        meta.regularMarketOpen,
        getArrayNumber(quote.open, latestIndex),
        price
      )!,
      previousClose,
      marketCap: null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      week52High: firstNumber(meta.fiftyTwoWeekHigh, null) ?? null,
      week52Low: firstNumber(meta.fiftyTwoWeekLow, null) ?? null,
      avgVolume: null,
      beta: null,
      lastUpdated
    };
  }

  async getKLines(
    symbol: string,
    interval: KLineInterval = DEFAULT_KLINE_INTERVAL
  ): Promise<KLineSeries> {
    const params = YAHOO_KLINE_PARAMS[interval];
    const { result } = await this.fetchChart(symbol, {
      range: params.range,
      interval: params.interval
    });
    const candles = this.transformChartResultToCandles(result);
    const normalizedCandles = params.aggregateByYear
      ? aggregateCandlesByYear(candles)
      : candles;

    if (normalizedCandles.length === 0) {
      throw {
        code: 'INVALID_SYMBOL',
        message: `Yahoo Finance k-line data was unavailable for ${symbol}`,
        details: {
          provider: this.id,
          interval
        }
      } as APIError;
    }

    const startDate = new Date(normalizedCandles[0].timestamp).toISOString();
    const endDate = new Date(
      normalizedCandles[normalizedCandles.length - 1].timestamp
    ).toISOString();
    const range: TimeRange = {
      startDate,
      endDate,
      interval
    };

    return {
      symbol: normalizeSymbol(symbol),
      range,
      candles: normalizedCandles,
      lastUpdated: endDate
    };
  }

  async healthCheck(): Promise<ProviderHealthCheck> {
    const startedAt = this.now();
    const checkedAt = new Date(startedAt).toISOString();

    try {
      await this.fetchChart(this.healthSymbol, {
        range: '1d',
        interval: '1d'
      });

      return {
        provider: this.name,
        providerId: this.id,
        status: 'healthy',
        latencyMs: Math.max(0, this.now() - startedAt),
        checkedAt,
        details: {
          symbol: this.healthSymbol
        }
      };
    } catch (error) {
      const apiError = this.isAPIError(error)
        ? error
        : this.createAPIError(error, 'Yahoo Finance health check failed');

      return {
        provider: this.name,
        providerId: this.id,
        status: 'degraded',
        latencyMs: Math.max(0, this.now() - startedAt),
        checkedAt,
        details: {
          code: apiError.code,
          message: apiError.message,
          retryAfter:
            typeof apiError.details?.retryAfter === 'number'
              ? apiError.details.retryAfter
              : undefined
        }
      };
    }
  }

  private async fetchChart(
    symbol: string,
    params: Record<string, string>
  ): Promise<YahooChartFetchResult> {
    const yahooSymbol = this.toYahooSymbol(symbol);
    const url = new URL(
      `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(yahooSymbol)}`
    );

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    let response: Response;

    try {
      response = await this.fetchImpl(url.toString(), {
        cache: 'no-store'
      });
    } catch (error) {
      throw this.createAPIError(error, 'Yahoo Finance network request failed');
    }

    const payload = await readYahooChartResponse(response);

    if (!response.ok) {
      throw this.createHTTPError(response, payload);
    }

    const providerError = payload?.chart?.error;
    if (providerError) {
      throw this.createProviderError(providerError);
    }

    const result = payload?.chart?.result?.[0];
    if (!result) {
      throw {
        code: 'INVALID_SYMBOL',
        message: `Yahoo Finance symbol was not found or is unsupported: ${symbol}`,
        details: {
          provider: this.id,
          symbol: yahooSymbol
        }
      } as APIError;
    }

    return {
      result,
      yahooSymbol
    };
  }

  private transformChartResultToCandles(
    result: YahooChartResult
  ): KLineCandle[] {
    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};

    return timestamps
      .map((timestamp, index) => {
        const open = getArrayNumber(quote.open, index);
        const high = getArrayNumber(quote.high, index);
        const low = getArrayNumber(quote.low, index);
        const close = getArrayNumber(quote.close, index);
        const volume = getArrayNumber(quote.volume, index);

        if (
          open === undefined ||
          high === undefined ||
          low === undefined ||
          close === undefined
        ) {
          return null;
        }

        return {
          timestamp: timestamp * 1000,
          open,
          high,
          low,
          close,
          volume: volume ?? 0
        };
      })
      .filter((candle): candle is KLineCandle => candle !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private toYahooSymbol(symbol: string): string {
    const normalized = normalizeSymbol(symbol);

    if (normalized.endsWith('.US')) {
      return normalized.slice(0, -3);
    }

    return normalized;
  }

  private createHTTPError(
    response: Response,
    payload: YahooChartResponse | null
  ): APIError {
    const message =
      payload?.chart?.error?.description ||
      response.statusText ||
      'Yahoo Finance request failed';
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    const details: Record<string, unknown> = {
      provider: this.id,
      statusCode: response.status
    };

    if (retryAfter) {
      details.retryAfter = retryAfter;
    }

    if (response.status === 429) {
      return {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Yahoo Finance rate limit exceeded. Please try again shortly.',
        details
      };
    }

    if (response.status === 404) {
      return {
        code: 'INVALID_SYMBOL',
        message,
        details
      };
    }

    if (response.status >= 500) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Yahoo Finance upstream service failed',
        details
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message,
      details
    };
  }

  private createProviderError(error: YahooChartError): APIError {
    const description = error.description || 'Yahoo Finance request failed';
    const normalized = `${error.code ?? ''} ${description}`.toLowerCase();

    if (
      normalized.includes('not found') ||
      normalized.includes('no data') ||
      normalized.includes('invalid symbol')
    ) {
      return {
        code: 'INVALID_SYMBOL',
        message: description,
        details: {
          provider: this.id,
          upstreamCode: error.code
        }
      };
    }

    if (
      normalized.includes('rate limit') ||
      normalized.includes('too many request') ||
      normalized.includes('quota')
    ) {
      return {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Yahoo Finance rate limit exceeded. Please try again shortly.',
        details: {
          provider: this.id,
          upstreamCode: error.code
        }
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: description,
      details: {
        provider: this.id,
        upstreamCode: error.code
      }
    };
  }

  private createAPIError(error: unknown, message: string): APIError {
    const details: Record<string, unknown> = {
      provider: this.id
    };

    if (error instanceof Error) {
      details.upstream = {
        name: error.name,
        message: error.message
      };
    }

    return {
      code: 'NETWORK_ERROR',
      message,
      details
    };
  }

  private isAPIError(error: unknown): error is APIError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    );
  }
}

async function readYahooChartResponse(
  response: Response
): Promise<YahooChartResponse | null> {
  try {
    return (await response.json()) as YahooChartResponse;
  } catch {
    return null;
  }
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function getLatestIndex(values?: Array<number | null>): number {
  if (!values) return -1;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (typeof values[index] === 'number' && Number.isFinite(values[index])) {
      return index;
    }
  }

  return -1;
}

function getArrayNumber(
  values: Array<number | null> | undefined,
  index: number
): number | undefined {
  if (!values || index < 0) return undefined;

  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getPreviousNumber(
  values: Array<number | null> | undefined,
  index: number
): number | undefined {
  if (!values || index <= 0) return undefined;

  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const value = getArrayNumber(values, previousIndex);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function firstNumber(
  ...values: Array<number | null | undefined>
): number | undefined {
  return values.find(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
  );
}

function aggregateCandlesByYear(candles: KLineCandle[]): KLineCandle[] {
  const groups = new Map<number, KLineCandle>();

  candles.forEach((candle) => {
    const year = new Date(candle.timestamp).getUTCFullYear();
    const existing = groups.get(year);

    if (!existing) {
      groups.set(year, {
        timestamp: Date.UTC(year, 0, 1),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      });
      return;
    }

    groups.set(year, {
      ...existing,
      high: Math.max(existing.high, candle.high),
      low: Math.min(existing.low, candle.low),
      close: candle.close,
      volume: existing.volume + candle.volume
    });
  });

  return Array.from(groups.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;

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
