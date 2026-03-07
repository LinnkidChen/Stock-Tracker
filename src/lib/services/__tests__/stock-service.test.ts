import { StockService, getStockService } from '../stock-service';
import { StockProviderFactory } from '../../providers/factory';
import { StockQuote, APIError, KLineSeries } from '../../types/stock-api';
import { CANONICAL_QUOTE_PROVIDER } from '../../providers/config';

jest.mock('../../providers/factory', () => ({
  StockProviderFactory: {
    getProvider: jest.fn()
  }
}));

const mockGetProvider = StockProviderFactory.getProvider as jest.MockedFunction<
  typeof StockProviderFactory.getProvider
>;

const mockQuote: StockQuote = {
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

describe('StockService', () => {
  let stockService: StockService;
  let provider: {
    getQuote: jest.Mock;
    getKLines: jest.Mock;
  };

  beforeEach(() => {
    provider = {
      getQuote: jest.fn(),
      getKLines: jest.fn()
    };

    mockGetProvider.mockReturnValue(provider as any);
    stockService = new StockService();
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    it('uses the canonical provider by default', async () => {
      provider.getQuote.mockResolvedValue(mockQuote);

      const result = await stockService.getQuote('AAPL');

      expect(mockGetProvider).toHaveBeenCalledWith(CANONICAL_QUOTE_PROVIDER);
      expect(provider.getQuote).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(mockQuote);
    });

    it('passes through API errors from the provider layer', async () => {
      const apiError: APIError = {
        code: 'INVALID_PROVIDER',
        message: 'Unsupported provider'
      };
      provider.getQuote.mockRejectedValue(apiError);

      await expect(
        stockService.getQuote('AAPL', 'legacy-provider')
      ).rejects.toBe(apiError);
    });

    it('wraps unknown provider failures', async () => {
      const error = new Error('boom');
      provider.getQuote.mockRejectedValue(error);

      await expect(stockService.getQuote('AAPL')).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote',
        details: { originalError: error }
      });
    });
  });

  describe('getKLineSeries', () => {
    it('returns series data from the configured provider', async () => {
      provider.getKLines.mockResolvedValue(mockSeries);

      const result = await stockService.getKLineSeries(
        'AAPL',
        'week',
        'default'
      );

      expect(mockGetProvider).toHaveBeenCalledWith('default');
      expect(provider.getKLines).toHaveBeenCalledWith('AAPL', 'week');
      expect(result).toEqual(mockSeries);
    });

    it('defaults to the day interval when none is provided', async () => {
      provider.getKLines.mockResolvedValue(mockSeries);

      await stockService.getKLineSeries('AAPL');

      expect(provider.getKLines).toHaveBeenCalledWith('AAPL', 'day');
      expect(mockGetProvider).toHaveBeenCalledWith(CANONICAL_QUOTE_PROVIDER);
    });

    it('wraps unexpected kline errors', async () => {
      const error = new Error('timeout');
      provider.getKLines.mockRejectedValue(error);

      await expect(stockService.getKLineSeries('AAPL')).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch kline series',
        details: { originalError: error }
      });
    });
  });

  describe('getMultipleQuotes', () => {
    it('returns fulfilled quotes and ignores partial failures', async () => {
      jest
        .spyOn(stockService, 'getQuote')
        .mockResolvedValueOnce(mockQuote)
        .mockRejectedValueOnce({
          code: 'INVALID_SYMBOL',
          message: 'Invalid symbol'
        } as APIError);

      const result = await stockService.getMultipleQuotes(['AAPL', 'BAD']);

      expect(result).toEqual([mockQuote]);
    });

    it('throws when every quote request fails', async () => {
      const apiError: APIError = {
        code: 'INVALID_SYMBOL',
        message: 'Invalid symbol'
      };

      jest
        .spyOn(stockService, 'getQuote')
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError);

      await expect(
        stockService.getMultipleQuotes(['BAD1', 'BAD2'])
      ).rejects.toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch any stock quotes',
        details: {
          errors: [
            { symbol: 'BAD1', error: apiError },
            { symbol: 'BAD2', error: apiError }
          ]
        }
      });
    });

    it('returns an empty array for an empty symbol list', async () => {
      await expect(stockService.getMultipleQuotes([])).resolves.toEqual([]);
    });
  });
});

describe('getStockService', () => {
  it('creates a new StockService instance for each call', () => {
    const service1 = getStockService();
    const service2 = getStockService();

    expect(service1).toBeInstanceOf(StockService);
    expect(service2).toBeInstanceOf(StockService);
    expect(service1).not.toBe(service2);
  });
});
