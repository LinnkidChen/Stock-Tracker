/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
import { checkRateLimit } from '@/lib/rate-limit';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { APIResponse, KLineSeries } from '@/lib/types/stock-api';
import {
  CANONICAL_QUOTE_PROVIDER,
  LEGACY_DEFAULT_QUOTE_PROVIDER
} from '@/lib/providers/config';
import {
  createMockRequest,
  createMockParams
} from '../../../__tests__/request-fixtures';

const removedProvider = ['alpha', 'vantage'].join('');

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => {
      const headers = new Map<string, string>();

      if (init?.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          headers.set(key, value);
        });
      }

      return {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: {
          get: (key: string) => headers.get(key)
        }
      };
    })
  },
  NextRequest: class NextRequestMock {}
}));

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_context: unknown, callback: any) =>
    callback({ setAttribute: jest.fn() })
  ),
  captureException: jest.fn()
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  createRateLimitHeaders: jest.fn((result) =>
    result.retryAfter
      ? {
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
        }
      : {}
  )
}));

jest.mock('@/lib/services/stock-service');
jest.mock('@/lib/validation/ticker');

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;
const mockGetStockService = getStockService as jest.MockedFunction<
  typeof getStockService
>;
const mockValidateTicker = validateTicker as jest.MockedFunction<
  typeof validateTicker
>;
const mockNormalizeTicker = normalizeTicker as jest.MockedFunction<
  typeof normalizeTicker
>;

const mockStockServiceInstance = {
  getKLineSeries: jest.fn()
};

const mockSeries: KLineSeries = {
  symbol: 'AAPL',
  range: {
    startDate: '2023-01-01T00:00:00.000Z',
    endDate: '2024-01-01T00:00:00.000Z',
    interval: 'day'
  },
  candles: [
    {
      timestamp: 1704067200000,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000000
    }
  ],
  lastUpdated: '2024-01-01T00:00:00.000Z'
};

describe('/api/stocks/kline/[symbol] API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 60,
      windowSeconds: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
      source: 'supabase'
    });
    mockGetStockService.mockReturnValue(mockStockServiceInstance as any);
    mockNormalizeTicker.mockImplementation((value: string) =>
      value.trim().toUpperCase()
    );
    mockValidateTicker.mockReturnValue({ isValid: true });
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns kline data with the canonical provider when no provider is supplied', async () => {
    mockStockServiceInstance.getKLineSeries.mockResolvedValue(mockSeries);

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );
    const responseData: APIResponse<KLineSeries> = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data).toEqual(mockSeries);
    expect(mockStockServiceInstance.getKLineSeries).toHaveBeenCalledWith(
      'AAPL',
      'day',
      CANONICAL_QUOTE_PROVIDER
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=604800'
    );
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.anything(), 'kline');
  });

  it('returns 429 when the shared limiter rejects the kline request', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      limit: 60,
      windowSeconds: 60,
      remaining: 0,
      resetAt: Date.now() + 9_000,
      retryAfter: 9,
      source: 'supabase'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(429);
    expect(responseData.error?.code).toBe('API_LIMIT_EXCEEDED');
    expect(response.headers.get('Retry-After')).toBe('9');
    expect(mockStockServiceInstance.getKLineSeries).not.toHaveBeenCalled();
  });

  it('passes the canonical provider through to the service layer', async () => {
    mockStockServiceInstance.getKLineSeries.mockResolvedValue(mockSeries);

    await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL', {
        query: { provider: CANONICAL_QUOTE_PROVIDER }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(mockStockServiceInstance.getKLineSeries).toHaveBeenCalledWith(
      'AAPL',
      'day',
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('passes the requested interval and legacy default alias through to the service layer', async () => {
    mockStockServiceInstance.getKLineSeries.mockResolvedValue(mockSeries);

    await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL', {
        query: {
          provider: LEGACY_DEFAULT_QUOTE_PROVIDER,
          interval: 'week'
        }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(mockStockServiceInstance.getKLineSeries).toHaveBeenCalledWith(
      'AAPL',
      'week',
      LEGACY_DEFAULT_QUOTE_PROVIDER
    );
  });

  it('returns 400 for invalid symbols', async () => {
    mockValidateTicker.mockReturnValue({
      isValid: false,
      error: 'Ticker symbol is required'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/'),
      {
        params: createMockParams('').params
      }
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toEqual({
      code: 'INVALID_SYMBOL',
      message: 'Ticker symbol is required'
    });
  });

  it('returns 400 for invalid kline intervals', async () => {
    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL', {
        query: { interval: 'quarter' }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toEqual({
      code: 'INVALID_INTERVAL',
      message: 'Unsupported kline interval: quarter'
    });
    expect(mockStockServiceInstance.getKLineSeries).not.toHaveBeenCalled();
  });

  it('returns 400 for the removed provider alias', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'INVALID_PROVIDER',
      message: `Unsupported provider: ${removedProvider}`
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL', {
        query: { provider: removedProvider }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for unknown providers', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'INVALID_PROVIDER',
      message: 'Unsupported provider: legacy-provider'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL', {
        query: { provider: 'legacy-provider' }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(400);
  });

  it('maps INVALID_API_KEY to 401', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'INVALID_API_KEY',
      message: 'Longbridge credentials not configured'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(401);
  });

  it('maps API_LIMIT_EXCEEDED to 429', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'API_LIMIT_EXCEEDED',
      message: 'Rate limit',
      details: {
        retryAfter: 7
      }
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('7');
  });

  it('maps NETWORK_ERROR to 502', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'NETWORK_ERROR',
      message: 'Upstream error'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(502);
  });

  it('maps UNKNOWN_ERROR to 500', async () => {
    mockStockServiceInstance.getKLineSeries.mockRejectedValue({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/kline/AAPL'),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(500);
  });
});
