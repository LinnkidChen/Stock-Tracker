/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
import { getOptionalRateLimitUserId } from '@/lib/rate-limit-auth';
import { consumeStockReadRateLimit } from '@/lib/rate-limit';
import { StockProviderFactory } from '@/lib/providers/factory';
import { APIResponse } from '@/lib/types/stock-api';
import { ProviderHealthCheck } from '@/lib/providers/types';
import { createMockRequest } from '../../../__tests__/request-fixtures';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => {
      const headers = new Map<string, string>();

      if (init?.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          headers.set(key, value as string);
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

jest.mock('@/lib/providers/factory', () => ({
  StockProviderFactory: {
    getProvider: jest.fn()
  }
}));
jest.mock('@/lib/rate-limit-auth', () => ({
  getOptionalRateLimitUserId: jest.fn()
}));
jest.mock('@/lib/rate-limit', () => ({
  consumeStockReadRateLimit: jest.fn(),
  recordRateLimitTelemetry: jest.fn(),
  toRateLimitError: jest.fn((result) => result.error)
}));

const mockGetProvider = StockProviderFactory.getProvider as jest.MockedFunction<
  typeof StockProviderFactory.getProvider
>;
const mockGetOptionalRateLimitUserId =
  getOptionalRateLimitUserId as jest.MockedFunction<
    typeof getOptionalRateLimitUserId
  >;
const mockConsumeStockReadRateLimit =
  consumeStockReadRateLimit as jest.MockedFunction<
    typeof consumeStockReadRateLimit
  >;

const mockProvider = {
  healthCheck: jest.fn()
};

describe('/api/stocks/providers/health API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider as any);
    mockGetOptionalRateLimitUserId.mockResolvedValue(null);
    mockConsumeStockReadRateLimit.mockResolvedValue({
      allowed: true,
      degraded: false,
      policy: 'anonymousStockReads',
      scope: 'stock-read',
      subject: { type: 'ip', id: '127.0.0.1' },
      source: 'upstash'
    });
  });

  it('returns healthy provider status', async () => {
    const health: ProviderHealthCheck = {
      provider: 'Longbridge',
      status: 'healthy',
      latencyMs: 12,
      checkedAt: '2024-01-01T00:00:00.000Z',
      details: {
        symbol: 'AAPL.US'
      }
    };
    mockProvider.healthCheck.mockResolvedValue(health);

    const response = await GET(
      createMockRequest(
        'http://localhost:3000/api/stocks/providers/health?provider=longbridge'
      )
    );
    const responseData: APIResponse<ProviderHealthCheck> =
      await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.data).toEqual(health);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mockGetProvider).toHaveBeenCalledWith('longbridge');
    expect(mockConsumeStockReadRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      null
    );
  });

  it('returns 429 when the stock read limiter denies the request', async () => {
    mockConsumeStockReadRateLimit.mockResolvedValueOnce({
      allowed: false,
      degraded: false,
      policy: 'anonymousStockReads',
      scope: 'stock-read',
      subject: { type: 'ip', id: '127.0.0.1' },
      source: 'upstash',
      limit: 120,
      remaining: 0,
      reset: 6000,
      retryAfter: 5,
      headers: {
        'Retry-After': '5',
        'RateLimit-Limit': '120',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '6'
      },
      error: {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please try again later.',
        details: { retryAfter: 5 }
      }
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(responseData.error?.code).toBe('API_LIMIT_EXCEEDED');
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it('returns degraded provider status', async () => {
    const health: ProviderHealthCheck = {
      provider: 'Longbridge',
      status: 'degraded',
      latencyMs: 8,
      checkedAt: '2024-01-01T00:00:00.000Z',
      details: {
        code: 'NETWORK_ERROR',
        message: 'Longbridge network request failed'
      }
    };
    mockProvider.healthCheck.mockResolvedValue(health);

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<ProviderHealthCheck> =
      await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data?.status).toBe('degraded');
    expect(responseData.data?.details?.code).toBe('NETWORK_ERROR');
  });

  it('returns unconfigured provider status without leaking credentials', async () => {
    process.env.LONGPORT_ACCESS_TOKEN = 'secret-token-for-health-route';
    const health: ProviderHealthCheck = {
      provider: 'Longbridge',
      status: 'unconfigured',
      latencyMs: 0,
      checkedAt: '2024-01-01T00:00:00.000Z',
      details: {
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      }
    };
    mockProvider.healthCheck.mockResolvedValue(health);

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<ProviderHealthCheck> =
      await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data?.status).toBe('unconfigured');
    expect(JSON.stringify(responseData)).not.toContain(
      'secret-token-for-health-route'
    );
  });
});
