/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { APIResponse, KLineSeries } from '@/lib/types/stock-api';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => {
      const mockHeaders = new Map();
      if (init?.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          mockHeaders.set(key, value);
        });
      }

      return {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: {
          get: (key: string) => mockHeaders.get(key),
          set: (key: string, value: string) => mockHeaders.set(key, value),
          has: (key: string) => mockHeaders.has(key),
          delete: (key: string) => mockHeaders.delete(key),
          forEach: (callback: (value: string, key: string) => void) =>
            mockHeaders.forEach(callback)
        }
      };
    })
  }
}));

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_context: any, callback: any) =>
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
  getKLineSeries: jest.fn()
};

const mockSeries: KLineSeries = {
  symbol: 'AAPL',
  range: {
    startDate: '2023-01-01T00:00:00.000Z',
    endDate: '2024-01-01T00:00:00.000Z',
    interval: '1d'
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
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2024-01-01T00:00:00.000Z');
    mockGetStockService.mockReturnValue(mockStockServiceInstance as any);
    mockNormalizeTicker.mockImplementation((s: string) =>
      s?.trim().toUpperCase()
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns kline series for valid symbol', async () => {
    mockValidateTicker.mockReturnValue({ isValid: true });
    mockStockServiceInstance.getKLineSeries.mockResolvedValue(mockSeries);

    const mockRequest = {
      nextUrl: { pathname: '/api/stocks/kline/AAPL' }
    } as any;
    const params = Promise.resolve({ symbol: 'AAPL' });

    const response = await GET(mockRequest, { params });
    const responseData: APIResponse<KLineSeries> = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      data: mockSeries,
      error: null,
      timestamp: '2024-01-01T00:00:00.000Z'
    });
    expect(mockValidateTicker).toHaveBeenCalledWith('AAPL');
    expect(mockStockServiceInstance.getKLineSeries).toHaveBeenCalledWith(
      'AAPL'
    );
  });

  it('includes cache headers on success', async () => {
    mockValidateTicker.mockReturnValue({ isValid: true });
    mockStockServiceInstance.getKLineSeries.mockResolvedValue(mockSeries);

    const mockRequest = {
      nextUrl: { pathname: '/api/stocks/kline/AAPL' }
    } as any;
    const params = Promise.resolve({ symbol: 'AAPL' });

    const response = await GET(mockRequest, { params });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=604800'
    );
  });

  it('returns 400 for invalid symbol', async () => {
    mockValidateTicker.mockReturnValue({
      isValid: false,
      error: 'Ticker symbol is required'
    });

    const mockRequest = {
      nextUrl: { pathname: '/api/stocks/kline/' }
    } as any;
    const params = Promise.resolve({ symbol: '' });

    const response = await GET(mockRequest, { params });
    const responseData: APIResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error?.code).toBe('INVALID_SYMBOL');
    expect(responseData.error?.message).toBe('Ticker symbol is required');
  });

  describe('error mapping', () => {
    beforeEach(() => {
      mockValidateTicker.mockReturnValue({ isValid: true });
    });

    it('maps INVALID_API_KEY to 401', async () => {
      mockStockServiceInstance.getKLineSeries.mockRejectedValue({
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      });

      const mockRequest = {
        nextUrl: { pathname: '/api/stocks/kline/AAPL' }
      } as any;
      const params = Promise.resolve({ symbol: 'AAPL' });

      const response = await GET(mockRequest, { params });

      expect(response.status).toBe(401);
    });

    it('maps API_LIMIT_EXCEEDED to 429', async () => {
      mockStockServiceInstance.getKLineSeries.mockRejectedValue({
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit'
      });

      const mockRequest = {
        nextUrl: { pathname: '/api/stocks/kline/AAPL' }
      } as any;
      const params = Promise.resolve({ symbol: 'AAPL' });

      const response = await GET(mockRequest, { params });

      expect(response.status).toBe(429);
    });

    it('maps NETWORK_ERROR to 502', async () => {
      mockStockServiceInstance.getKLineSeries.mockRejectedValue({
        code: 'NETWORK_ERROR',
        message: 'Upstream error'
      });

      const mockRequest = {
        nextUrl: { pathname: '/api/stocks/kline/AAPL' }
      } as any;
      const params = Promise.resolve({ symbol: 'AAPL' });

      const response = await GET(mockRequest, { params });

      expect(response.status).toBe(502);
    });

    it('maps UNKNOWN_ERROR to 500', async () => {
      mockStockServiceInstance.getKLineSeries.mockRejectedValue({
        code: 'UNKNOWN_ERROR',
        message: 'Unknown'
      });

      const mockRequest = {
        nextUrl: { pathname: '/api/stocks/kline/AAPL' }
      } as any;
      const params = Promise.resolve({ symbol: 'AAPL' });

      const response = await GET(mockRequest, { params });

      expect(response.status).toBe(500);
    });
  });
});
