import { LongbridgeProvider } from '../longbridge';
import { LongbridgeRequestGuard } from '../longbridge-request-guard';
import { consumeLongbridgeProviderBudget } from '../../rate-limit';

const mockCandlesticks = jest.fn();
const mockConfigFromEnv = jest.fn(() => ({}));
const mockQuote = jest.fn();
const mockQuoteContextNew = jest.fn();

jest.mock('longport', () => ({
  Config: {
    fromEnv: (...args: unknown[]) => mockConfigFromEnv(...args)
  },
  QuoteContext: {
    new: (...args: unknown[]) => mockQuoteContextNew(...args)
  },
  AdjustType: {},
  Period: {},
  TradeSessions: {}
}));

jest.mock('../../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../../rate-limit', () => ({
  consumeLongbridgeProviderBudget: jest.fn(),
  toRateLimitError: jest.fn((result) => result.error)
}));

const quoteFixture = {
  symbol: 'AAPL.US',
  timestamp: new Date('2024-01-02T15:30:00.000Z'),
  lastDone: 105,
  prevClose: 100,
  volume: 1000,
  high: 110,
  low: 95,
  open: 101
};

function createProvider(options: any = {}) {
  return new LongbridgeProvider({
    requestGuard: new LongbridgeRequestGuard({
      maxConcurrent: 100,
      maxStartsPerWindow: 1000,
      sleep: async () => undefined
    }),
    sleep: async () => undefined,
    ...options
  });
}

describe('LongbridgeProvider', () => {
  const mockConsumeLongbridgeProviderBudget =
    consumeLongbridgeProviderBudget as jest.MockedFunction<
      typeof consumeLongbridgeProviderBudget
    >;
  const originalEnv = {
    LONGPORT_APP_KEY: process.env.LONGPORT_APP_KEY,
    LONGPORT_APP_SECRET: process.env.LONGPORT_APP_SECRET,
    LONGPORT_ACCESS_TOKEN: process.env.LONGPORT_ACCESS_TOKEN
  };

  beforeEach(() => {
    process.env.LONGPORT_APP_KEY = 'app-key';
    process.env.LONGPORT_APP_SECRET = 'app-secret';
    process.env.LONGPORT_ACCESS_TOKEN = 'token';

    LongbridgeProvider.clearHealthCacheForTests();
    mockCandlesticks.mockReset();
    mockConfigFromEnv.mockClear();
    mockQuote.mockReset();
    mockQuoteContextNew.mockReset();
    mockConsumeLongbridgeProviderBudget.mockResolvedValue({
      allowed: true,
      degraded: false,
      policy: 'longbridgeQuoteBudget',
      scope: 'provider-budget',
      subject: { type: 'global', id: 'global' },
      source: 'upstash'
    });
    mockQuoteContextNew.mockResolvedValue({
      candlesticks: mockCandlesticks,
      quote: mockQuote
    });
  });

  afterAll(() => {
    process.env.LONGPORT_APP_KEY = originalEnv.LONGPORT_APP_KEY;
    process.env.LONGPORT_APP_SECRET = originalEnv.LONGPORT_APP_SECRET;
    process.env.LONGPORT_ACCESS_TOKEN = originalEnv.LONGPORT_ACCESS_TOKEN;
  });

  describe('getQuote', () => {
    it('returns a transformed quote', async () => {
      mockQuote.mockResolvedValue([quoteFixture]);

      const quote = await createProvider().getQuote('AAPL');

      expect(mockQuote).toHaveBeenCalledWith(['AAPL.US']);
      expect(mockConsumeLongbridgeProviderBudget).toHaveBeenCalledWith('quote');
      expect(quote).toEqual(
        expect.objectContaining({
          symbol: 'AAPL.US',
          price: 105,
          change: 5,
          changePercent: 5,
          previousClose: 100,
          lastUpdated: '2024-01-02T15:30:00.000Z'
        })
      );
    });

    it('does not call the SDK when the shared quote budget is exceeded', async () => {
      mockConsumeLongbridgeProviderBudget.mockResolvedValueOnce({
        allowed: false,
        degraded: false,
        policy: 'longbridgeQuoteBudget',
        scope: 'provider-budget',
        subject: { type: 'global', id: 'global' },
        source: 'upstash',
        limit: 600,
        remaining: 0,
        reset: 6000,
        retryAfter: 5,
        error: {
          code: 'API_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          details: {
            retryAfter: 5,
            scope: 'provider-budget'
          }
        }
      });

      await expect(createProvider().getQuote('AAPL')).rejects.toMatchObject({
        code: 'API_LIMIT_EXCEEDED',
        details: {
          retryAfter: 5
        }
      });
      expect(mockQuoteContextNew).not.toHaveBeenCalled();
      expect(mockQuote).not.toHaveBeenCalled();
    });

    it('continues to the in-process guard when the shared budget fails open', async () => {
      mockConsumeLongbridgeProviderBudget.mockResolvedValueOnce({
        allowed: true,
        degraded: true,
        policy: 'longbridgeQuoteBudget',
        scope: 'provider-budget',
        subject: { type: 'global', id: 'global' },
        source: 'error'
      });
      mockQuote.mockResolvedValue([quoteFixture]);

      const quote = await createProvider().getQuote('AAPL');

      expect(quote.price).toBe(105);
      expect(mockQuote).toHaveBeenCalledWith(['AAPL.US']);
    });

    it('throws INVALID_API_KEY when credentials are missing', async () => {
      delete process.env.LONGPORT_APP_KEY;

      await expect(createProvider().getQuote('AAPL')).rejects.toEqual({
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      });
      expect(mockQuoteContextNew).not.toHaveBeenCalled();
    });

    it('maps empty quote responses to INVALID_SYMBOL', async () => {
      mockQuote.mockResolvedValue([]);

      await expect(createProvider().getQuote('BAD')).rejects.toEqual({
        code: 'INVALID_SYMBOL',
        message: 'No quote data found for symbol: BAD'
      });
      expect(mockQuote).toHaveBeenCalledTimes(1);
    });

    it('maps persistent Longbridge rate limits and preserves retryAfter', async () => {
      const rateLimitError = Object.assign(new Error('rate limit exceeded'), {
        status: 429,
        headers: {
          get: (name: string) => (name === 'retry-after' ? '2' : undefined)
        }
      });
      mockQuote.mockRejectedValue(rateLimitError);

      await expect(
        createProvider({ maxAttempts: 2 }).getQuote('AAPL')
      ).rejects.toMatchObject({
        code: 'API_LIMIT_EXCEEDED',
        details: {
          retryAfter: 2
        }
      });
      expect(mockQuote).toHaveBeenCalledTimes(2);
    });

    it('maps network timeouts to NETWORK_ERROR', async () => {
      const timeoutError = Object.assign(new Error('connect ETIMEDOUT'), {
        code: 'ETIMEDOUT'
      });
      mockQuote.mockRejectedValue(timeoutError);

      await expect(
        createProvider({ maxAttempts: 1 }).getQuote('AAPL')
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Longbridge network request failed'
      });
      expect(mockQuote).toHaveBeenCalledTimes(1);
    });

    it('retries transient failures and returns a successful quote', async () => {
      const resetError = Object.assign(new Error('socket hang up'), {
        code: 'ECONNRESET'
      });
      const sleep = jest.fn(async () => undefined);

      mockQuote
        .mockRejectedValueOnce(resetError)
        .mockResolvedValueOnce([quoteFixture]);

      const quote = await createProvider({ sleep }).getQuote('AAPL');

      expect(quote.price).toBe(105);
      expect(mockQuote).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(250);
    });

    it('does not retry invalid symbol SDK failures', async () => {
      mockQuote.mockRejectedValue(new Error('invalid symbol'));

      await expect(createProvider().getQuote('BAD')).rejects.toMatchObject({
        code: 'INVALID_SYMBOL'
      });
      expect(mockQuote).toHaveBeenCalledTimes(1);
    });

    it('does not retry authentication failures', async () => {
      const authError = Object.assign(new Error('invalid access token'), {
        status: 401
      });
      mockQuote.mockRejectedValue(authError);

      await expect(createProvider().getQuote('AAPL')).rejects.toMatchObject({
        code: 'INVALID_API_KEY'
      });
      expect(mockQuote).toHaveBeenCalledTimes(1);
    });
  });

  describe('getKLines', () => {
    it.each([
      ['day', 14],
      ['week', 15],
      ['month', 16],
      ['year', 18]
    ] as const)(
      'maps the %s interval to Longbridge period %i',
      async (interval, expectedPeriod) => {
        mockCandlesticks.mockResolvedValue([
          {
            timestamp: new Date('2024-01-02T00:00:00.000Z'),
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 1000
          }
        ]);

        const series = await createProvider().getKLines('AAPL', interval);

        expect(mockCandlesticks).toHaveBeenCalledWith(
          'AAPL.US',
          expectedPeriod,
          1000,
          1,
          1
        );
        expect(series.range.interval).toBe(interval);
        expect(series.symbol).toBe('AAPL');
      }
    );

    it('defaults to the day interval when none is provided', async () => {
      mockCandlesticks.mockResolvedValue([]);

      await createProvider().getKLines('AAPL');

      expect(mockCandlesticks).toHaveBeenCalledWith('AAPL.US', 14, 1000, 1, 1);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy status and caches the live probe inside the TTL', async () => {
      mockQuote.mockResolvedValue([quoteFixture]);
      let now = Date.parse('2024-01-02T00:00:00.000Z');
      const provider = createProvider({
        healthCacheTtlMs: 1000,
        now: () => now
      });

      const first = await provider.healthCheck();
      now += 500;
      const second = await provider.healthCheck();

      expect(first.status).toBe('healthy');
      expect(second).toBe(first);
      expect(mockQuote).toHaveBeenCalledTimes(1);
      expect(mockQuote).toHaveBeenCalledWith(['AAPL.US']);
    });

    it('returns degraded status for network failures', async () => {
      mockQuote.mockRejectedValue(new Error('gateway timeout'));

      const health = await createProvider().healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.details).toEqual(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          message: 'Longbridge network request failed'
        })
      );
    });

    it('returns unconfigured status without leaking credential values', async () => {
      process.env.LONGPORT_ACCESS_TOKEN = 'secret-access-token';
      delete process.env.LONGPORT_APP_KEY;

      const health = await createProvider().healthCheck();

      expect(health.status).toBe('unconfigured');
      expect(JSON.stringify(health)).not.toContain('secret-access-token');
      expect(mockQuoteContextNew).not.toHaveBeenCalled();
    });
  });
});
