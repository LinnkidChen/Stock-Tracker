import { FallbackStockDataProvider } from '../fallback-provider';
import type { StockQuote, KLineSeries } from '../../types/stock-api';

const mockQuote: StockQuote = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 150,
  change: 1,
  changePercent: 0.67,
  volume: 1000,
  high: 151,
  low: 149,
  open: 149.5,
  previousClose: 149,
  marketCap: null,
  peRatio: null,
  eps: null,
  dividendYield: null,
  week52High: null,
  week52Low: null,
  avgVolume: null,
  beta: null,
  lastUpdated: '2024-01-01T00:00:00.000Z'
};

const mockSeries: KLineSeries = {
  symbol: 'AAPL',
  range: {
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-02T00:00:00.000Z',
    interval: 'day'
  },
  candles: [
    {
      timestamp: 1704067200000,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000
    }
  ],
  lastUpdated: '2024-01-02T00:00:00.000Z'
};

const mockProviders = {
  longbridge: {
    id: 'longbridge',
    name: 'Longbridge',
    capabilities: {},
    getQuote: jest.fn(),
    getKLines: jest.fn(),
    healthCheck: jest.fn()
  },
  yahoo: {
    id: 'yahoo',
    name: 'Yahoo Finance',
    capabilities: {},
    getQuote: jest.fn(),
    getKLines: jest.fn(),
    healthCheck: jest.fn()
  }
};

const mockCreateRegisteredProvider = jest.fn(
  (id: 'longbridge' | 'yahoo') => mockProviders[id]
);
const mockGetProviderRoutingPlan = jest.fn(() => ({
  requestedProvider: 'auto',
  operation: 'quote',
  symbol: 'AAPL',
  market: 'US',
  providers: ['longbridge', 'yahoo'],
  reason: 'test route'
}));

jest.mock('../registry', () => ({
  createRegisteredProvider: (id: 'longbridge' | 'yahoo') =>
    mockCreateRegisteredProvider(id),
  getFallbackOrder: () => ['longbridge', 'yahoo'],
  getProviderRoutingPlan: (...args: unknown[]) =>
    mockGetProviderRoutingPlan(...args),
  listProviderMetadata: () => [
    {
      id: 'longbridge',
      name: 'Longbridge',
      label: 'Longbridge',
      fallbackRank: 10,
      capabilities: {
        quotes: true,
        kLines: true,
        realtime: 'polling',
        intervals: ['day', 'week', 'month', 'year'],
        markets: ['US'],
        requiresCredentials: true
      }
    },
    {
      id: 'yahoo',
      name: 'Yahoo Finance',
      label: 'Yahoo Finance',
      fallbackRank: 20,
      capabilities: {
        quotes: true,
        kLines: true,
        realtime: 'polling',
        intervals: ['day', 'week', 'month', 'year'],
        markets: ['US', 'GLOBAL'],
        requiresCredentials: false
      }
    }
  ]
}));

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('FallbackStockDataProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProviders.longbridge.getQuote.mockReset();
    mockProviders.longbridge.getKLines.mockReset();
    mockProviders.yahoo.getQuote.mockReset();
    mockProviders.yahoo.getKLines.mockReset();
    mockGetProviderRoutingPlan.mockReturnValue({
      requestedProvider: 'auto',
      operation: 'quote',
      symbol: 'AAPL',
      market: 'US',
      providers: ['longbridge', 'yahoo'],
      reason: 'test route'
    });
  });

  it('falls back to the next provider when the primary provider fails', async () => {
    mockProviders.longbridge.getQuote.mockRejectedValue({
      code: 'INVALID_API_KEY',
      message: 'Longbridge credentials not configured'
    });
    mockProviders.yahoo.getQuote.mockResolvedValue(mockQuote);

    await expect(
      new FallbackStockDataProvider().getQuote('AAPL')
    ).resolves.toBe(mockQuote);

    expect(mockProviders.longbridge.getQuote).toHaveBeenCalledWith('AAPL');
    expect(mockProviders.yahoo.getQuote).toHaveBeenCalledWith('AAPL');
  });

  it('includes routing and attempt metadata when every provider fails', async () => {
    mockProviders.longbridge.getQuote.mockRejectedValue({
      code: 'INVALID_API_KEY',
      message: 'Longbridge credentials not configured'
    });
    mockProviders.yahoo.getQuote.mockRejectedValue({
      code: 'NETWORK_ERROR',
      message: 'Yahoo Finance network request failed'
    });

    await expect(
      new FallbackStockDataProvider().getQuote('AAPL')
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'NETWORK_ERROR',
        details: expect.objectContaining({
          providerFallback: expect.objectContaining({
            route: ['longbridge', 'yahoo'],
            attempts: [
              expect.objectContaining({ providerId: 'longbridge' }),
              expect.objectContaining({ providerId: 'yahoo' })
            ]
          })
        })
      })
    );
  });

  it('routes k-line requests with the requested interval', async () => {
    mockGetProviderRoutingPlan.mockReturnValue({
      requestedProvider: 'auto',
      operation: 'kline',
      symbol: 'AAPL',
      market: 'US',
      providers: ['yahoo'],
      reason: 'test kline route'
    });
    mockProviders.yahoo.getKLines.mockResolvedValue(mockSeries);

    await expect(
      new FallbackStockDataProvider().getKLines('AAPL', 'day')
    ).resolves.toBe(mockSeries);

    expect(mockGetProviderRoutingPlan).toHaveBeenCalledWith({
      provider: 'auto',
      symbol: 'AAPL',
      operation: 'kline',
      interval: 'day'
    });
    expect(mockProviders.yahoo.getKLines).toHaveBeenCalledWith('AAPL', 'day');
  });
});
