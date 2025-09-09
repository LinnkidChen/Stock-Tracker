import {
  AlphaVantageClient,
  getAlphaVantageClient
} from '../alpha-vantage-client';
import {
  AlphaVantageResponse,
  APIError,
  StockSearchResult
} from '../../types/stock-api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AbortController
global.AbortController = jest.fn(() => ({
  signal: {},
  abort: jest.fn()
})) as any;

// Mock setTimeout/clearTimeout
jest.useFakeTimers();

describe('AlphaVantageClient', () => {
  const mockApiKey = 'test-api-key';
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance with provided API key', () => {
      const client = new AlphaVantageClient(mockApiKey);
      expect(client).toBeInstanceOf(AlphaVantageClient);
    });

    it('should use environment variable when no API key provided', () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'env-api-key';
      const client = new AlphaVantageClient();
      expect(client).toBeInstanceOf(AlphaVantageClient);
    });

    it('should throw error when no API key available', () => {
      delete process.env.ALPHA_VANTAGE_API_KEY;
      expect(() => new AlphaVantageClient()).toThrow(
        'Alpha Vantage API key is required'
      );
    });

    it('should prioritize provided API key over environment variable', () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'env-api-key';
      const client = new AlphaVantageClient(mockApiKey);
      expect(client).toBeInstanceOf(AlphaVantageClient);
    });
  });

  describe('fetchQuote', () => {
    let client: AlphaVantageClient;

    beforeEach(() => {
      client = new AlphaVantageClient(mockApiKey);
    });

    const mockSuccessResponse: AlphaVantageResponse = {
      'Global Quote': {
        '01. symbol': 'AAPL',
        '02. open': '150.00',
        '03. high': '152.00',
        '04. low': '149.00',
        '05. price': '151.50',
        '06. volume': '1000000',
        '07. latest trading day': '2023-12-01',
        '08. previous close': '150.50',
        '09. change': '1.00',
        '10. change percent': '0.66%'
      }
    };

    it('should successfully fetch quote for valid symbol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      const result = await client.fetchQuote('AAPL');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('function=GLOBAL_QUOTE'),
        expect.objectContaining({
          signal: expect.any(Object)
        })
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should convert symbol to uppercase', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      });

      await client.fetchQuote('aapl');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=AAPL'),
        expect.any(Object)
      );
    });

    it('should throw INVALID_SYMBOL error for invalid symbol format', async () => {
      const invalidSymbols = ['AA-PL', 'AAPL!', 'AA PL', ''];

      for (const symbol of invalidSymbols) {
        await expect(client.fetchQuote(symbol)).rejects.toEqual({
          code: 'INVALID_SYMBOL',
          message: 'Symbol must contain only alphanumeric characters'
        });
      }
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'HTTP error! status: 500',
        details: { originalError: expect.any(Error) }
      });
    });

    it('should handle API error message response', async () => {
      const errorResponse = {
        'Error Message':
          'Invalid API call. Please retry or visit the documentation'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorResponse
      });

      await expect(client.fetchQuote('INVALID')).rejects.toEqual({
        code: 'INVALID_SYMBOL',
        message: 'Invalid API call. Please retry or visit the documentation'
      });
    });

    it('should handle API limit exceeded response', async () => {
      const limitResponse = {
        Note: 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => limitResponse
      });

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'API_LIMIT_EXCEEDED',
        message: 'API call frequency limit exceeded',
        details: { note: limitResponse.Note }
      });
    });

    it('should handle empty Global Quote response', async () => {
      const emptyResponse = {
        'Global Quote': {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse
      });

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'INVALID_SYMBOL',
        message: 'No data found for symbol: AAPL'
      });
    });

    it('should handle missing Global Quote response', async () => {
      const invalidResponse = {
        'Meta Data': {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse
      });

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'INVALID_SYMBOL',
        message: 'No data found for symbol: AAPL'
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network connection failed',
        details: { originalError: expect.any(Error) }
      });
    });

    it('should handle timeout', async () => {
      const abortController = {
        signal: { aborted: false },
        abort: jest.fn(() => {
          abortController.signal.aborted = true;
        })
      };
      (global.AbortController as jest.Mock).mockReturnValueOnce(
        abortController
      );

      // Mock fetch that never resolves to simulate timeout
      const neverResolvingPromise = new Promise(() => {
        // This promise never resolves
      });
      mockFetch.mockReturnValueOnce(neverResolvingPromise);

      const fetchPromise = client.fetchQuote('AAPL');

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(10000);

      expect(abortController.abort).toHaveBeenCalled();

      // The test completes when timeout triggers, no need to await the promise
    }, 15000);

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(client.fetchQuote('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'Invalid JSON',
        details: { originalError: expect.any(Error) }
      });
    });

    it('should re-throw existing APIError without wrapping', async () => {
      const existingError: APIError = {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded'
      };

      mockFetch.mockRejectedValueOnce(existingError);

      await expect(client.fetchQuote('AAPL')).rejects.toEqual(existingError);
    });
  });

  describe('searchSymbol', () => {
    let client: AlphaVantageClient;

    beforeEach(() => {
      client = new AlphaVantageClient(mockApiKey);
    });

    const mockSearchResults: StockSearchResult[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'Equity',
        region: 'United States',
        marketOpen: '09:30',
        marketClose: '16:00',
        timezone: 'UTC-04',
        currency: 'USD'
      },
      {
        symbol: 'AAPLW',
        name: 'Apple Inc. Warrant',
        type: 'Warrant',
        region: 'United States',
        marketOpen: '09:30',
        marketClose: '16:00',
        timezone: 'UTC-04',
        currency: 'USD'
      }
    ];

    it('should successfully search symbols', async () => {
      const mockResponse = {
        bestMatches: mockSearchResults
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.searchSymbol('AAPL');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('function=SYMBOL_SEARCH'),
        expect.objectContaining({
          signal: expect.any(Object)
        })
      );
      expect(result).toEqual(mockSearchResults);
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        bestMatches: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.searchSymbol('NONEXISTENT');

      expect(result).toEqual([]);
    });

    it('should handle missing bestMatches property', async () => {
      const mockResponse = {};

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.searchSymbol('AAPL');

      expect(result).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(client.searchSymbol('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'HTTP error! status: 404',
        details: { originalError: expect.any(Error) }
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(client.searchSymbol('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'Connection timeout',
        details: { originalError: expect.any(Error) }
      });
    });

    it('should handle timeout', async () => {
      const abortController = {
        signal: { aborted: false },
        abort: jest.fn(() => {
          abortController.signal.aborted = true;
        })
      };
      (global.AbortController as jest.Mock).mockReturnValueOnce(
        abortController
      );

      // Mock fetch that never resolves to simulate timeout
      const neverResolvingPromise = new Promise(() => {
        // This promise never resolves
      });
      mockFetch.mockReturnValueOnce(neverResolvingPromise);

      const searchPromise = client.searchSymbol('AAPL');

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(10000);

      expect(abortController.abort).toHaveBeenCalled();

      // The test completes when timeout triggers, no need to await the promise
    }, 15000);

    it('should include keywords in request', async () => {
      const mockResponse = { bestMatches: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await client.searchSymbol('Apple Technology');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('keywords=Apple+Technology'),
        expect.any(Object)
      );
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Malformed JSON response');
        }
      });

      await expect(client.searchSymbol('AAPL')).rejects.toEqual({
        code: 'NETWORK_ERROR',
        message: 'Malformed JSON response',
        details: { originalError: expect.any(Error) }
      });
    });
  });

  describe('URL construction', () => {
    let client: AlphaVantageClient;

    beforeEach(() => {
      client = new AlphaVantageClient(mockApiKey);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 'Global Quote': { '01. symbol': 'AAPL' } })
      });
    });

    it('should construct correct URL for fetchQuote', async () => {
      await client.fetchQuote('AAPL');

      const expectedUrl = expect.stringMatching(
        /^https:\/\/www\.alphavantage\.co\/query\?function=GLOBAL_QUOTE&symbol=AAPL&apikey=test-api-key$/
      );

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should construct correct URL for searchSymbol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bestMatches: [] })
      });

      await client.searchSymbol('Apple');

      const expectedUrl = expect.stringMatching(
        /^https:\/\/www\.alphavantage\.co\/query\?function=SYMBOL_SEARCH&keywords=Apple&apikey=test-api-key$/
      );

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });
});

describe('getAlphaVantageClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create new AlphaVantageClient instance', () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
    const client = getAlphaVantageClient();
    expect(client).toBeInstanceOf(AlphaVantageClient);
  });

  it('should create different instances on each call', () => {
    process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
    const client1 = getAlphaVantageClient();
    const client2 = getAlphaVantageClient();
    expect(client1).not.toBe(client2);
    expect(client1).toBeInstanceOf(AlphaVantageClient);
    expect(client2).toBeInstanceOf(AlphaVantageClient);
  });

  it('should throw error when no API key available', () => {
    delete process.env.ALPHA_VANTAGE_API_KEY;
    expect(() => getAlphaVantageClient()).toThrow(
      'Alpha Vantage API key is required'
    );
  });
});
