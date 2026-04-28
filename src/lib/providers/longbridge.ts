import {
  StockQuote,
  APIError,
  DEFAULT_KLINE_INTERVAL,
  type KLineInterval,
  KLineSeries,
  KLineCandle,
  TimeRange
} from '../types/stock-api';
import { logger } from '../logger';
import { ProviderHealthCheck, StockDataProvider } from './types';
import {
  Config,
  QuoteContext,
  Candlestick,
  Period,
  AdjustType,
  TradeSessions
} from 'longport';
import {
  normalizeLongbridgeError,
  sanitizeLongbridgeAPIError
} from './longbridge-errors';
import {
  longbridgeRequestGuard,
  LongbridgeRequestGuard
} from './longbridge-request-guard';

const LONG_BRIDGE_KLINE_COUNT = 1000;
const LONG_BRIDGE_MAX_ATTEMPTS = 3;
const LONG_BRIDGE_RETRY_BASE_DELAY_MS = 250;
const LONG_BRIDGE_RETRY_MAX_DELAY_MS = 2000;
const LONG_BRIDGE_HEALTH_CACHE_TTL_MS = 30_000;
const LONG_BRIDGE_HEALTH_SYMBOL = 'AAPL.US';

// Longbridge exposes const-enum Period values where 17 is Quarter and 18 is Year.
const LONG_BRIDGE_PERIOD_MAP: Record<KLineInterval, number> = {
  day: 14,
  week: 15,
  month: 16,
  year: 18
};

interface LongbridgeProviderOptions {
  requestGuard?: LongbridgeRequestGuard;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttempts?: number;
  healthCacheTtlMs?: number;
  healthSymbol?: string;
}

interface ExecuteOptions {
  maxAttempts?: number;
  logLabel: string;
}

export class LongbridgeProvider implements StockDataProvider {
  name = 'Longbridge';
  private static healthCache:
    | {
        expiresAt: number;
        value: ProviderHealthCheck;
      }
    | undefined;
  private static healthInFlight: Promise<ProviderHealthCheck> | undefined;

  private readonly requestGuard: LongbridgeRequestGuard;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly healthCacheTtlMs: number;
  private readonly healthSymbol: string;

  constructor(options: LongbridgeProviderOptions = {}) {
    this.requestGuard = options.requestGuard ?? longbridgeRequestGuard;
    this.sleep =
      options.sleep ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.maxAttempts = options.maxAttempts ?? LONG_BRIDGE_MAX_ATTEMPTS;
    this.healthCacheTtlMs =
      options.healthCacheTtlMs ?? LONG_BRIDGE_HEALTH_CACHE_TTL_MS;
    this.healthSymbol = options.healthSymbol ?? LONG_BRIDGE_HEALTH_SYMBOL;
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    this.ensureConfigured();

    return this.executeWithResilience(
      async () => {
        const config = Config.fromEnv();
        const context = await QuoteContext.new(config);

        const longbridgeSymbol = this.normalizeSymbol(symbol);
        const quote = await context.quote([longbridgeSymbol]);

        if (!quote || quote.length === 0) {
          throw {
            code: 'INVALID_SYMBOL',
            message: `No quote data found for symbol: ${symbol}`
          } as APIError;
        }

        const q = quote[0];
        const lastUpdated = q.timestamp
          ? q.timestamp.toISOString()
          : new Date().toISOString();

        const price = Number(q.lastDone);
        const prevClose = Number(q.prevClose);
        const change = price - prevClose;
        const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

        return {
          symbol: q.symbol,
          name: q.symbol,
          price: price,
          change: change,
          changePercent: changePercent,
          volume: Number(q.volume),
          high: Number(q.high),
          low: Number(q.low),
          open: Number(q.open),
          previousClose: prevClose,
          marketCap: null,
          peRatio: null,
          eps: null,
          dividendYield: null,
          week52High: null,
          week52Low: null,
          avgVolume: null,
          beta: null,
          lastUpdated: lastUpdated
        };
      },
      'Failed to fetch stock quote from Longbridge',
      { logLabel: 'Longbridge Quote Error' }
    );
  }

  async getKLines(
    symbol: string,
    interval: KLineInterval = DEFAULT_KLINE_INTERVAL
  ): Promise<KLineSeries> {
    this.ensureConfigured();

    return this.executeWithResilience(
      async () => {
        const config = Config.fromEnv();
        const context = await QuoteContext.new(config);

        const longbridgeSymbol = this.normalizeSymbol(symbol);

        // Fetch candles using numeric values to avoid isolatedModules const enum issues.
        const period = LONG_BRIDGE_PERIOD_MAP[interval];
        // AdjustType.ForwardAdjust = 1
        // TradeSessions.All = 1
        const candlesData = await context.candlesticks(
          longbridgeSymbol,
          period as unknown as Period,
          LONG_BRIDGE_KLINE_COUNT,
          1 as unknown as AdjustType,
          1 as unknown as TradeSessions
        );

        return this.transformCandlesticksToSeries(
          candlesData,
          symbol,
          interval
        );
      },
      'Failed to fetch kline series from Longbridge',
      { logLabel: 'Longbridge KLine Error' }
    );
  }

  async healthCheck(): Promise<ProviderHealthCheck> {
    const now = this.now();
    const cached = LongbridgeProvider.healthCache;

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    if (LongbridgeProvider.healthInFlight) {
      return LongbridgeProvider.healthInFlight;
    }

    LongbridgeProvider.healthInFlight = this.performHealthCheck().then(
      (health) => {
        LongbridgeProvider.healthCache = {
          value: health,
          expiresAt: this.now() + this.healthCacheTtlMs
        };
        return health;
      }
    );

    try {
      return await LongbridgeProvider.healthInFlight;
    } finally {
      LongbridgeProvider.healthInFlight = undefined;
    }
  }

  static clearHealthCacheForTests(): void {
    LongbridgeProvider.healthCache = undefined;
    LongbridgeProvider.healthInFlight = undefined;
  }

  private async performHealthCheck(): Promise<ProviderHealthCheck> {
    const startedAt = this.now();
    const checkedAt = new Date(startedAt).toISOString();

    if (!this.hasCredentials()) {
      return {
        provider: this.name,
        status: 'unconfigured',
        latencyMs: 0,
        checkedAt,
        details: {
          code: 'INVALID_API_KEY',
          message: 'Longbridge credentials not configured'
        }
      };
    }

    try {
      await this.executeWithResilience(
        async () => {
          const config = Config.fromEnv();
          const context = await QuoteContext.new(config);
          const quote = await context.quote([this.healthSymbol]);

          if (!quote || quote.length === 0) {
            throw {
              code: 'INVALID_SYMBOL',
              message: `No quote data found for symbol: ${this.healthSymbol}`
            } as APIError;
          }
        },
        'Longbridge health check failed',
        {
          maxAttempts: 1,
          logLabel: 'Longbridge Health Check Error'
        }
      );

      return {
        provider: this.name,
        status: 'healthy',
        latencyMs: Math.max(0, this.now() - startedAt),
        checkedAt,
        details: {
          symbol: this.healthSymbol
        }
      };
    } catch (error) {
      const apiError = this.isAPIError(error)
        ? sanitizeLongbridgeAPIError(error)
        : normalizeLongbridgeError(error, 'Longbridge health check failed')
            .error;

      return {
        provider: this.name,
        status:
          apiError.code === 'INVALID_API_KEY' ? 'unconfigured' : 'degraded',
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

  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    fallbackMessage: string,
    options: ExecuteOptions
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? this.maxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.requestGuard.run(operation);
      } catch (error) {
        const normalized = normalizeLongbridgeError(error, fallbackMessage);
        const shouldRetry = normalized.retryable && attempt < maxAttempts;

        if (!shouldRetry) {
          logger.error(options.logLabel, {
            error: normalized.error,
            attempt,
            maxAttempts
          });
          throw normalized.error;
        }

        logger.warn('Longbridge transient failure; retrying', {
          code: normalized.error.code,
          attempt,
          maxAttempts
        });

        await this.sleep(this.getRetryDelayMs(attempt, normalized.retryAfter));
      }
    }

    throw {
      code: 'UNKNOWN_ERROR',
      message: fallbackMessage
    } as APIError;
  }

  private getRetryDelayMs(attempt: number, retryAfter?: number): number {
    if (retryAfter) {
      return Math.min(retryAfter * 1000, LONG_BRIDGE_RETRY_MAX_DELAY_MS);
    }

    return Math.min(
      LONG_BRIDGE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
      LONG_BRIDGE_RETRY_MAX_DELAY_MS
    );
  }

  private ensureConfigured(): void {
    if (!this.hasCredentials()) {
      throw {
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      } as APIError;
    }
  }

  private hasCredentials(): boolean {
    return Boolean(
      process.env.LONGPORT_APP_KEY &&
        process.env.LONGPORT_APP_SECRET &&
        process.env.LONGPORT_ACCESS_TOKEN
    );
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.includes('.') ? symbol : `${symbol}.US`;
  }

  private transformCandlesticksToSeries(
    candlesData: Candlestick[],
    symbol: string,
    interval: KLineInterval
  ): KLineSeries {
    // Longbridge Candlestick: { close, high, low, open, timestamp, volume, ... }
    // Timestamp is a Date; convert to milliseconds for JS Date usage.

    const candles: KLineCandle[] = candlesData
      .map((c) => ({
        timestamp: c.timestamp.getTime(),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let startDate = new Date().toISOString();
    let endDate = new Date().toISOString();

    if (candles.length > 0) {
      startDate = new Date(candles[0].timestamp).toISOString();
      endDate = new Date(candles[candles.length - 1].timestamp).toISOString();
    }

    const range: TimeRange = {
      startDate,
      endDate,
      interval
    };

    return {
      symbol,
      range,
      candles,
      lastUpdated: endDate
    };
  }

  private isAPIError(error: any): error is APIError {
    const apiErrorCodes = [
      'INVALID_SYMBOL',
      'INVALID_INTERVAL',
      'INVALID_PROVIDER',
      'API_LIMIT_EXCEEDED',
      'NETWORK_ERROR',
      'INVALID_API_KEY',
      'UNKNOWN_ERROR'
    ];

    return (
      error &&
      typeof error === 'object' &&
      apiErrorCodes.includes(error.code) &&
      'message' in error
    );
  }
}
