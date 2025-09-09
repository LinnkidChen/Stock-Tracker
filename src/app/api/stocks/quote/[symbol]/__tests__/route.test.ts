/**
 * @jest-environment jsdom
 */
import { GET } from '../route';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker } from '@/lib/validation/ticker';
import { APIResponse, StockQuote, APIError } from '@/lib/types/stock-api';

// Mock Next.js server utilities
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

// Mock dependencies
jest.mock('@/lib/services/stock-service');
jest.mock('@/lib/validation/ticker');

const mockGetStockService = getStockService as jest.MockedFunction<
  typeof getStockService
>;
const mockValidateTicker = validateTicker as jest.MockedFunction<
  typeof validateTicker
>;

// Mock stock service instance
const mockStockServiceInstance = {
  getQuote: jest.fn()
};

// Mock stock quote data
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
  lastUpdated: '2023-01-01T10:00:00.000Z'
};

describe('/api/stocks/quote/[symbol] API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2023-01-01T10:00:00.000Z');
    mockGetStockService.mockReturnValue(mockStockServiceInstance as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET method', () => {
    it('should return stock quote for valid symbol', async () => {
      // Arrange
      mockValidateTicker.mockReturnValue({ isValid: true });
      mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

      const mockRequest = {} as any;
      const params = { symbol: 'AAPL' };

      // Act
      const response = await GET(mockRequest, { params });
      const responseData: APIResponse<StockQuote> = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        success: true,
        data: mockStockQuote,
        error: null,
        timestamp: '2023-01-01T10:00:00.000Z'
      });

      expect(mockValidateTicker).toHaveBeenCalledWith('AAPL');
      expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith('AAPL');
    });

    it('should include cache headers in successful response', async () => {
      // Arrange
      mockValidateTicker.mockReturnValue({ isValid: true });
      mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

      const mockRequest = {} as any;
      const params = { symbol: 'AAPL' };

      // Act
      const response = await GET(mockRequest, { params });

      // Assert
      expect(response.headers.get('Cache-Control')).toBe(
        'public, s-maxage=10, stale-while-revalidate=30'
      );
    });

    describe('Symbol validation', () => {
      it('should return 400 for invalid symbol - empty string', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({
          isValid: false,
          error: 'Ticker symbol is required'
        });

        const mockRequest = {} as any;
        const params = { symbol: '' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData).toEqual({
          success: false,
          data: null,
          error: {
            code: 'INVALID_SYMBOL',
            message: 'Ticker symbol is required'
          },
          timestamp: '2023-01-01T10:00:00.000Z'
        });

        expect(mockStockServiceInstance.getQuote).not.toHaveBeenCalled();
      });

      it('should return 400 for invalid symbol - too long', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({
          isValid: false,
          error: 'Ticker symbol must be 5 characters or less'
        });

        const mockRequest = {} as any;
        const params = { symbol: 'TOOLONG' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData).toEqual({
          success: false,
          data: null,
          error: {
            code: 'INVALID_SYMBOL',
            message: 'Ticker symbol must be 5 characters or less'
          },
          timestamp: '2023-01-01T10:00:00.000Z'
        });
      });

      it('should return 400 for invalid symbol - special characters', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({
          isValid: false,
          error: 'Ticker symbol must contain only letters'
        });

        const mockRequest = {} as any;
        const params = { symbol: 'AAP@' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData.error?.code).toBe('INVALID_SYMBOL');
        expect(responseData.error?.message).toBe(
          'Ticker symbol must contain only letters'
        );
      });

      it('should return 400 for invalid symbol - numbers', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({
          isValid: false,
          error: 'Ticker symbol must contain only letters'
        });

        const mockRequest = {} as any;
        const params = { symbol: 'AAP1' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData.error?.code).toBe('INVALID_SYMBOL');
      });

      it('should return 400 for validation without error message', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({ isValid: false });

        const mockRequest = {} as any;
        const params = { symbol: 'INVALID' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData.error?.message).toBe('Invalid ticker symbol');
      });
    });

    describe('Stock service error handling', () => {
      beforeEach(() => {
        mockValidateTicker.mockReturnValue({ isValid: true });
      });

      it('should handle INVALID_SYMBOL error from stock service', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'INVALID_SYMBOL',
          message: 'Symbol not found'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'INVALID' };

        // Act
        await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(responseData).toEqual({
          success: false,
          data: null,
          error: apiError,
          timestamp: '2023-01-01T10:00:00.000Z'
        });
      });

      it('should handle API_LIMIT_EXCEEDED error (429)', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'API_LIMIT_EXCEEDED',
          message: 'API limit exceeded'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(429);
        expect(responseData.error?.code).toBe('API_LIMIT_EXCEEDED');
      });

      it('should handle INVALID_API_KEY error (401)', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(401);
      });

      it('should handle NETWORK_ERROR (502)', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(502);
      });

      it('should handle UNKNOWN_ERROR (500)', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'UNKNOWN_ERROR',
          message: 'Unknown error occurred'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(500);
      });

      it('should handle unknown error code (defaults to 500)', async () => {
        // Arrange
        const apiError: APIError = {
          code: 'CUSTOM_ERROR' as any,
          message: 'Custom error occurred'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(apiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(500);
      });
    });

    describe('Unexpected error handling', () => {
      beforeEach(() => {
        mockValidateTicker.mockReturnValue({ isValid: true });
      });

      it('should handle non-APIError exceptions', async () => {
        // Arrange
        const unexpectedError = new Error('Database connection failed');
        mockStockServiceInstance.getQuote.mockRejectedValue(unexpectedError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(responseData).toEqual({
          success: false,
          data: null,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred'
          },
          timestamp: '2023-01-01T10:00:00.000Z'
        });
      });

      it('should handle null/undefined errors', async () => {
        // Arrange
        mockStockServiceInstance.getQuote.mockRejectedValue(null);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(responseData.error?.code).toBe('UNKNOWN_ERROR');
      });

      it('should handle string errors', async () => {
        // Arrange
        mockStockServiceInstance.getQuote.mockRejectedValue(
          'Something went wrong'
        );

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });

        // Assert
        expect(response.status).toBe(500);
      });

      it('should handle objects that look like APIError but are not', async () => {
        // Arrange
        const fakeApiError = {
          code: 'FAKE_ERROR',
          message: 'This is not a real APIError',
          extraField: 'should not be here'
        };
        mockStockServiceInstance.getQuote.mockRejectedValue(fakeApiError);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<null> = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(responseData.error?.code).toBe('FAKE_ERROR');
        expect(responseData.error?.message).toBe('This is not a real APIError');
      });
    });

    describe('Response format validation', () => {
      it('should always include required APIResponse fields', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({ isValid: true });
        mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<StockQuote> = await response.json();

        // Assert
        expect(responseData).toHaveProperty('success');
        expect(responseData).toHaveProperty('data');
        expect(responseData).toHaveProperty('error');
        expect(responseData).toHaveProperty('timestamp');
        expect(typeof responseData.success).toBe('boolean');
        expect(typeof responseData.timestamp).toBe('string');
      });

      it('should have proper timestamp format', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({ isValid: true });
        mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<StockQuote> = await response.json();

        // Assert
        expect(responseData.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle symbol with whitespace', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({ isValid: true });
        mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

        const mockRequest = {} as any;
        const params = { symbol: ' AAPL ' };

        // Act
        await GET(mockRequest, { params });

        // Assert
        expect(mockValidateTicker).toHaveBeenCalledWith(' AAPL ');
        expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith(
          ' AAPL '
        );
      });

      it('should handle lowercase symbols', async () => {
        // Arrange
        mockValidateTicker.mockReturnValue({ isValid: true });
        mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

        const mockRequest = {} as any;
        const params = { symbol: 'aapl' };

        // Act
        await GET(mockRequest, { params });

        // Assert
        expect(mockValidateTicker).toHaveBeenCalledWith('aapl');
        expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith('aapl');
      });

      it('should handle quote data with null optional fields', async () => {
        // Arrange
        const quoteWithNulls: StockQuote = {
          ...mockStockQuote,
          marketCap: null,
          peRatio: null,
          eps: null,
          dividendYield: null,
          week52High: null,
          week52Low: null,
          avgVolume: null,
          beta: null
        };

        mockValidateTicker.mockReturnValue({ isValid: true });
        mockStockServiceInstance.getQuote.mockResolvedValue(quoteWithNulls);

        const mockRequest = {} as any;
        const params = { symbol: 'AAPL' };

        // Act
        const response = await GET(mockRequest, { params });
        const responseData: APIResponse<StockQuote> = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(responseData.data).toEqual(quoteWithNulls);
      });
    });
  });

  describe('HTTP method validation', () => {
    it('should only export GET method', () => {
      // This test verifies that only GET is exported from the route file
      const routeModule = require('../route');

      expect(routeModule.GET).toBeDefined();
      expect(routeModule.POST).toBeUndefined();
      expect(routeModule.PUT).toBeUndefined();
      expect(routeModule.DELETE).toBeUndefined();
      expect(routeModule.PATCH).toBeUndefined();
    });
  });

  describe('Parameter handling', () => {
    it('should handle missing symbol parameter', async () => {
      // Arrange - this simulates Next.js behavior when symbol is undefined
      mockValidateTicker.mockReturnValue({
        isValid: false,
        error: 'Ticker symbol is required'
      });

      const mockRequest = {} as any;
      const params = { symbol: undefined as any };

      // Act
      const response = await GET(mockRequest, { params });
      const responseData: APIResponse<null> = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error?.code).toBe('INVALID_SYMBOL');
    });
  });

  describe('Service integration', () => {
    it('should call getStockService to get fresh instance', async () => {
      // Arrange
      mockValidateTicker.mockReturnValue({ isValid: true });
      mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

      const mockRequest = {} as any;
      const params = { symbol: 'AAPL' };

      // Act
      await GET(mockRequest, { params });

      // Assert
      expect(mockGetStockService).toHaveBeenCalledTimes(1);
      expect(mockGetStockService).toHaveBeenCalledWith();
    });

    it('should pass exact symbol to stock service', async () => {
      // Arrange
      mockValidateTicker.mockReturnValue({ isValid: true });
      mockStockServiceInstance.getQuote.mockResolvedValue(mockStockQuote);

      const testSymbol = 'TSLA';
      const mockRequest = {} as any;
      const params = { symbol: testSymbol };

      // Act
      await GET(mockRequest, { params });

      // Assert
      expect(mockStockServiceInstance.getQuote).toHaveBeenCalledWith(
        testSymbol
      );
    });
  });
});
