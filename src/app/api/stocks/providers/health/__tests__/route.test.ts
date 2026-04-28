/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
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

const mockGetProvider = StockProviderFactory.getProvider as jest.MockedFunction<
  typeof StockProviderFactory.getProvider
>;

const mockProvider = {
  healthCheck: jest.fn()
};

describe('/api/stocks/providers/health API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider as any);
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
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<ProviderHealthCheck> =
      await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.data).toEqual(health);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mockGetProvider).toHaveBeenCalledWith('longbridge');
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

  it('checks the requested provider when query param is present', async () => {
    const health: ProviderHealthCheck = {
      provider: 'Longbridge',
      status: 'healthy',
      latencyMs: 10,
      checkedAt: '2024-01-01T00:00:00.000Z'
    };
    mockProvider.healthCheck.mockResolvedValue(health);

    const response = await GET(
      createMockRequest(
        'http://localhost:3000/api/stocks/providers/health?provider=mock'
      )
    );

    expect(response.status).toBe(200);
    expect(mockGetProvider).toHaveBeenCalledWith('mock');
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

  it('returns API errors from provider lookup failures', async () => {
    mockGetProvider.mockImplementation(() => {
      throw {
        code: 'INVALID_PROVIDER',
        message: 'Provider is not supported'
      };
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toEqual({
      code: 'INVALID_PROVIDER',
      message: 'Provider is not supported'
    });
  });

  it('returns 5xx API errors from provider health failures', async () => {
    mockProvider.healthCheck.mockRejectedValue({
      code: 'NETWORK_ERROR',
      message: 'Longbridge network request failed'
    });

    const response = await GET(
      createMockRequest('http://localhost:3000/api/stocks/providers/health')
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(502);
    expect(responseData.success).toBe(false);
    expect(responseData.error?.code).toBe('NETWORK_ERROR');
  });

  it('wraps unexpected provider errors', async () => {
    mockProvider.healthCheck.mockRejectedValue(new Error('boom'));

    const response = await GET({} as any);
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred'
    });
  });

  it('handles malformed request URLs while reporting provider errors', async () => {
    mockProvider.healthCheck.mockRejectedValue({
      code: 'NETWORK_ERROR',
      message: 'Longbridge network request failed'
    });

    const response = await GET({ url: 'not a url' } as any);

    expect(response.status).toBe(502);
  });
});
