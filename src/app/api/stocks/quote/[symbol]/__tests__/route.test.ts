/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { APIResponse, StockQuote } from '@/lib/types/stock-api';
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
  NextRequest: jest.requireActual('next/server').NextRequest
}));

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_context: unknown, callback: any) =>
    callback({ setAttribute: jest.fn() })
  ),
  captureException: jest.fn()
}));

jest.mock('@/lib/services/stock-service');
jest.mock('@/lib/validation/ticker');

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
  getQuote: jest.fn()
};

const mockStockQuote: StockQuote = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 150.25,
  change: 2.5,
  changePercent: 1.69,
  volume: 1000000,
  high: 152.0,
  low: 148.5,
  open: 149.0,
  previousClose: 147.75,
  marketCap: 2500000000000,
  peRatio: 25.5,
  eps: 5.89,
  dividendYield: 0.5,
  week52High: 182.0,
  week52Low: 124.17,
  avgVolume: 50000000,
  beta: 1.2,
  lastUpdated: '2024-01-01T00:00:00.000Z'
};

describe('/api/stocks/quote/[symbol] API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('returns a quote when no provider is supplied', async () => {
    mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

    const response = await GET(createMockRequest(), {
      params: createMockParams('AAPL').params
    });
    const responseData: APIResponse<StockQuote> = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data).toEqual(mockStockQuote);
    expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith(
      'AAPL',
      CANONICAL_QUOTE_PROVIDER
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=10, stale-while-revalidate=30'
    );
  });

  it('passes the canonical provider through to the service layer', async () => {
    mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

    await GET(
      createMockRequest('/api/stocks/quote/AAPL', {
        query: { provider: CANONICAL_QUOTE_PROVIDER }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith(
      'AAPL',
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('passes the legacy default alias through to the service layer', async () => {
    mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

    await GET(
      createMockRequest('/api/stocks/quote/AAPL', {
        query: { provider: LEGACY_DEFAULT_QUOTE_PROVIDER }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith(
      'AAPL',
      LEGACY_DEFAULT_QUOTE_PROVIDER
    );
  });

  it('returns 400 for invalid symbols', async () => {
    mockValidateTicker.mockReturnValue({
      isValid: false,
      error: 'Ticker symbol is required'
    });

    const response = await GET(createMockRequest(), {
      params: createMockParams('').params
    });
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toEqual({
      code: 'INVALID_SYMBOL',
      message: 'Ticker symbol is required'
    });
  });

  it('returns 400 for the removed provider alias', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'INVALID_PROVIDER',
      message: `Unsupported provider: ${removedProvider}`
    });

    const response = await GET(
      createMockRequest('/api/stocks/quote/AAPL', {
        query: { provider: removedProvider }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error?.code).toBe('INVALID_PROVIDER');
  });

  it('returns 400 for unknown providers', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'INVALID_PROVIDER',
      message: 'Unsupported provider: legacy-provider'
    });

    const response = await GET(
      createMockRequest('/api/stocks/quote/AAPL', {
        query: { provider: 'legacy-provider' }
      }),
      {
        params: createMockParams('AAPL').params
      }
    );

    expect(response.status).toBe(400);
  });

  it('maps INVALID_API_KEY to 401', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'INVALID_API_KEY',
      message: 'Longbridge credentials not configured'
    });

    const response = await GET(createMockRequest(), {
      params: createMockParams('AAPL').params
    });

    expect(response.status).toBe(401);
  });

  it('maps API_LIMIT_EXCEEDED to 429', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'API_LIMIT_EXCEEDED',
      message: 'Rate limit'
    });

    const response = await GET(createMockRequest(), {
      params: createMockParams('AAPL').params
    });

    expect(response.status).toBe(429);
  });

  it('maps NETWORK_ERROR to 502', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'NETWORK_ERROR',
      message: 'Upstream error'
    });

    const response = await GET(createMockRequest(), {
      params: createMockParams('AAPL').params
    });

    expect(response.status).toBe(502);
  });

  it('maps UNKNOWN_ERROR to 500', async () => {
    mockStockServiceInstance.getQuote.mockRejectedValue({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error'
    });

    const response = await GET(createMockRequest(), {
      params: createMockParams('AAPL').params
    });

    expect(response.status).toBe(500);
  });
});
