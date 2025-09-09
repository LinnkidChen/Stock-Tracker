import { StockService, getStockService } from '../stock-service';
import { getAlphaVantageClient } from '../alpha-vantage-client';
import {
  StockQuote,
  AlphaVantageResponse,
  APIError,
  StockSearchResult
} from '../../types/stock-api';
import { Stock } from '../../types';

// Mock the alpha vantage client
jest.mock('../alpha-vantage-client', () => ({
  getAlphaVantageClient: jest.fn()
}));

const mockGetAlphaVantageClient = getAlphaVantageClient as jest.MockedFunction<
  typeof getAlphaVantageClient
>;

// Mock setTimeout for delay testing
jest.useFakeTimers();

describe('StockService', () => {
  let stockService: StockService;
  let mockClient: {
    fetchQuote: jest.Mock;
    searchSymbol: jest.Mock;
  };

  beforeEach(() => {
    mockClient = {
      fetchQuote: jest.fn(),
      searchSymbol: jest.fn()
    };
    mockGetAlphaVantageClient.mockReturnValue(mockClient as any);
    stockService = new StockService();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    const mockAlphaVantageResponse: AlphaVantageResponse = {
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

    const expectedStockQuote: StockQuote = {
      symbol: 'AAPL',
      name: 'AAPL',
      price: 151.5,
      change: 1.0,
      changePercent: 0.66,
      volume: 1000000,
      high: 152.0,
      low: 149.0,
      open: 150.0,
      previousClose: 150.5,
      marketCap: null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      week52High: null,
      week52Low: null,
      avgVolume: null,
      beta: null,
      lastUpdated: '2023-12-01'
    };

    it('should successfully fetch and transform quote', async () => {
      mockClient.fetchQuote.mockResolvedValue(mockAlphaVantageResponse);

      const result = await stockService.getQuote('AAPL');

      expect(mockClient.fetchQuote).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(expectedStockQuote);
    });

    it('should handle missing Global Quote in response', async () => {
      const responseWithoutGlobalQuote = {};
      mockClient.fetchQuote.mockResolvedValue(responseWithoutGlobalQuote);

      await expect(stockService.getQuote('INVALID')).rejects.toEqual({
        code: 'INVALID_SYMBOL',
        message: 'No quote data found for symbol: INVALID'
      });
    });

    it('should handle empty Global Quote in response', async () => {
      const responseWithEmptyGlobalQuote: AlphaVantageResponse = {
        'Global Quote': {} as any
      };
      mockClient.fetchQuote.mockResolvedValue(responseWithEmptyGlobalQuote);

      // Empty Global Quote should still process but with fallback values
      const result = await stockService.getQuote('INVALID');

      expect(result).toEqual({
        symbol: 'INVALID',
        name: 'INVALID',
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        marketCap: null,
        peRatio: null,
        eps: null,
        dividendYield: null,
        week52High: null,
        week52Low: null,
        avgVolume: null,
        beta: null,
        lastUpdated: expect.stringMatching(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        )
      });
    });

    it('should re-throw APIError from client', async () => {
      const apiError: APIError = {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded'
      };
      mockClient.fetchQuote.mockRejectedValue(apiError);

      await expect(stockService.getQuote('AAPL')).rejects.toEqual(apiError);
    });

    it('should wrap non-APIError as APIError', async () => {
      const networkError = new Error('Network failure');
      mockClient.fetchQuote.mockRejectedValue(networkError);

      await expect(stockService.getQuote('AAPL')).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote',
        details: { originalError: networkError }
      });
    });

    it('should handle numeric parsing with fallbacks', async () => {
      const responseWithInvalidNumbers: AlphaVantageResponse = {
        'Global Quote': {
          '01. symbol': 'TEST',
          '02. open': 'invalid',
          '03. high': 'null',
          '04. low': 'None',
          '05. price': '100.50',
          '06. volume': '',
          '07. latest trading day': '2023-12-01',
          '08. previous close': '99.00',
          '09. change': 'NaN',
          '10. change percent': '1.5%'
        }
      };
      mockClient.fetchQuote.mockResolvedValue(responseWithInvalidNumbers);

      const result = await stockService.getQuote('TEST');

      expect(result).toEqual({
        symbol: 'TEST',
        name: 'TEST',
        price: 100.5,
        change: 0, // fallback for 'NaN'
        changePercent: 1.5,
        volume: 0, // fallback for empty string
        high: 0, // fallback for 'null'
        low: 0, // fallback for 'None'
        open: 0, // fallback for 'invalid'
        previousClose: 99.0,
        marketCap: null,
        peRatio: null,
        eps: null,
        dividendYield: null,
        week52High: null,
        week52Low: null,
        avgVolume: null,
        beta: null,
        lastUpdated: '2023-12-01'
      });
    });

    it('should handle change percent with % sign removal', async () => {
      const responseWithChangePercent: AlphaVantageResponse = {
        'Global Quote': {
          ...mockAlphaVantageResponse['Global Quote'],
          '10. change percent': '-2.34%'
        }
      };
      mockClient.fetchQuote.mockResolvedValue(responseWithChangePercent);

      const result = await stockService.getQuote('AAPL');

      expect(result.changePercent).toBe(-2.34);
    });

    it('should handle missing change percent field', async () => {
      const responseWithoutChangePercent: AlphaVantageResponse = {
        'Global Quote': {
          ...mockAlphaVantageResponse['Global Quote']
        }
      };
      delete (responseWithoutChangePercent['Global Quote'] as any)[
        '10. change percent'
      ];
      mockClient.fetchQuote.mockResolvedValue(responseWithoutChangePercent);

      const result = await stockService.getQuote('AAPL');

      expect(result.changePercent).toBe(0); // fallback for missing field
    });

    it('should use current date when latest trading day is missing', async () => {
      const responseWithoutTradingDay: AlphaVantageResponse = {
        'Global Quote': {
          ...mockAlphaVantageResponse['Global Quote']
        }
      };
      delete (responseWithoutTradingDay['Global Quote'] as any)[
        '07. latest trading day'
      ];
      mockClient.fetchQuote.mockResolvedValue(responseWithoutTradingDay);

      const result = await stockService.getQuote('AAPL');

      expect(result.lastUpdated).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    it('should use provided symbol when API symbol is missing', async () => {
      const responseWithoutSymbol: AlphaVantageResponse = {
        'Global Quote': {
          ...mockAlphaVantageResponse['Global Quote']
        }
      };
      delete (responseWithoutSymbol['Global Quote'] as any)['01. symbol'];
      mockClient.fetchQuote.mockResolvedValue(responseWithoutSymbol);

      const result = await stockService.getQuote('TEST');

      expect(result.symbol).toBe('TEST');
    });
  });

  describe('searchStocks', () => {
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
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        type: 'Equity',
        region: 'United States',
        marketOpen: '09:30',
        marketClose: '16:00',
        timezone: 'UTC-04',
        currency: 'USD'
      }
    ];

    const expectedStocks: Stock[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 0,
        change: 0,
        changePercent: 0
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        price: 0,
        change: 0,
        changePercent: 0
      }
    ];

    it('should successfully search and transform results', async () => {
      mockClient.searchSymbol.mockResolvedValue(mockSearchResults);

      const result = await stockService.searchStocks('apple');

      expect(mockClient.searchSymbol).toHaveBeenCalledWith('apple');
      expect(result).toEqual(expectedStocks);
    });

    it('should handle empty search results', async () => {
      mockClient.searchSymbol.mockResolvedValue([]);

      const result = await stockService.searchStocks('nonexistent');

      expect(result).toEqual([]);
    });

    it('should re-throw APIError from client', async () => {
      const apiError: APIError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed'
      };
      mockClient.searchSymbol.mockRejectedValue(apiError);

      await expect(stockService.searchStocks('apple')).rejects.toEqual(
        apiError
      );
    });

    it('should wrap non-APIError as APIError', async () => {
      const networkError = new Error('Timeout');
      mockClient.searchSymbol.mockRejectedValue(networkError);

      await expect(stockService.searchStocks('apple')).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to search stocks',
        details: { originalError: networkError }
      });
    });
  });

  describe('getMultipleQuotes', () => {
    const mockQuote1: StockQuote = {
      symbol: 'AAPL',
      name: 'AAPL',
      price: 151.5,
      change: 1.0,
      changePercent: 0.66,
      volume: 1000000,
      high: 152.0,
      low: 149.0,
      open: 150.0,
      previousClose: 150.5,
      marketCap: null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      week52High: null,
      week52Low: null,
      avgVolume: null,
      beta: null,
      lastUpdated: '2023-12-01'
    };

    const mockQuote2: StockQuote = {
      symbol: 'GOOGL',
      name: 'GOOGL',
      price: 2800.0,
      change: 25.0,
      changePercent: 0.9,
      volume: 500000,
      high: 2825.0,
      low: 2775.0,
      open: 2780.0,
      previousClose: 2775.0,
      marketCap: null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      week52High: null,
      week52Low: null,
      avgVolume: null,
      beta: null,
      lastUpdated: '2023-12-01'
    };

    beforeEach(() => {
      // Mock the getQuote method
      jest.spyOn(stockService, 'getQuote');
    });

    it('should fetch multiple quotes successfully', async () => {
      (stockService.getQuote as jest.Mock)
        .mockResolvedValueOnce(mockQuote1)
        .mockResolvedValueOnce(mockQuote2);

      const result = await stockService.getMultipleQuotes(['AAPL', 'GOOGL']);

      expect(stockService.getQuote).toHaveBeenCalledWith('AAPL');
      expect(stockService.getQuote).toHaveBeenCalledWith('GOOGL');
      expect(result).toEqual([mockQuote1, mockQuote2]);
    });

    it('should handle mixed success and failure', async () => {
      const apiError: APIError = {
        code: 'INVALID_SYMBOL',
        message: 'Invalid symbol'
      };

      (stockService.getQuote as jest.Mock)
        .mockResolvedValueOnce(mockQuote1)
        .mockRejectedValueOnce(apiError);

      const result = await stockService.getMultipleQuotes(['AAPL', 'INVALID']);

      expect(result).toEqual([mockQuote1]);
    });

    it('should handle all failures', async () => {
      const apiError: APIError = {
        code: 'INVALID_SYMBOL',
        message: 'Invalid symbol'
      };

      (stockService.getQuote as jest.Mock)
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError);

      await expect(
        stockService.getMultipleQuotes(['INVALID1', 'INVALID2'])
      ).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch any stock quotes',
        details: {
          errors: [
            { symbol: 'INVALID1', error: apiError },
            { symbol: 'INVALID2', error: apiError }
          ]
        }
      });
    });

    it('should handle non-APIError in batch processing', async () => {
      const networkError = new Error('Network failure');

      (stockService.getQuote as jest.Mock)
        .mockResolvedValueOnce(mockQuote1)
        .mockRejectedValueOnce(networkError);

      const result = await stockService.getMultipleQuotes(['AAPL', 'GOOGL']);

      expect(result).toEqual([mockQuote1]);
    });

    it('should process in batches with delay', async () => {
      // Create 7 symbols to test batching (batch size is 5)
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA'];
      const mockQuotes = symbols.map((symbol, index) => ({
        ...mockQuote1,
        symbol,
        price: 100 + index
      }));

      // Mock all getQuote calls to succeed
      const getQuoteSpy = stockService.getQuote as jest.Mock;
      symbols.forEach((_, index) => {
        getQuoteSpy.mockResolvedValueOnce(mockQuotes[index]);
      });

      // Start the batch processing
      const resultPromise = stockService.getMultipleQuotes(symbols);

      // Fast-forward time to trigger delay between batches
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toHaveLength(7);
      expect(result).toEqual(mockQuotes);
      expect(stockService.getQuote).toHaveBeenCalledTimes(7);
    }, 15000);

    it('should not add delay after last batch', async () => {
      // Test with exactly 5 symbols (one batch)
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
      const mockQuotes = symbols.map((symbol) => ({
        ...mockQuote1,
        symbol
      }));

      const getQuoteSpy = stockService.getQuote as jest.Mock;
      symbols.forEach((_, index) => {
        getQuoteSpy.mockResolvedValueOnce(mockQuotes[index]);
      });

      const result = await stockService.getMultipleQuotes(symbols);

      expect(result).toHaveLength(5);
      // No timers should be set for delay since it's the last (and only) batch
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should handle empty symbol array', async () => {
      const result = await stockService.getMultipleQuotes([]);

      expect(result).toEqual([]);
      expect(stockService.getQuote).not.toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    it('should correctly identify APIError', () => {
      const apiError: APIError = {
        code: 'INVALID_SYMBOL',
        message: 'Invalid symbol'
      };
      const regularError = new Error('Regular error');
      const nullValue = null;
      const invalidObject = { message: 'Missing code' };

      // Access private method through bracket notation for testing
      expect((stockService as any).isAPIError(apiError)).toBe(true);
      expect((stockService as any).isAPIError(regularError)).toBe(false);
      expect((stockService as any).isAPIError(nullValue)).toBeFalsy();
      expect((stockService as any).isAPIError(invalidObject)).toBe(false);
    });

    it('should create delay promise', async () => {
      const delayPromise = (stockService as any).delay(1000);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await expect(delayPromise).resolves.toBeUndefined();
    });

    it('should get alpha vantage client instance', () => {
      const client = (stockService as any).getClient();

      expect(mockGetAlphaVantageClient).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('constants', () => {
    it('should have correct batch size and delay', () => {
      expect((stockService as any).BATCH_SIZE).toBe(5);
      expect((stockService as any).BATCH_DELAY_MS).toBe(12000);
    });
  });
});

describe('getStockService', () => {
  it('should create new StockService instance', () => {
    const service = getStockService();
    expect(service).toBeInstanceOf(StockService);
  });

  it('should create different instances on each call', () => {
    const service1 = getStockService();
    const service2 = getStockService();
    expect(service1).not.toBe(service2);
    expect(service1).toBeInstanceOf(StockService);
    expect(service2).toBeInstanceOf(StockService);
  });
});
