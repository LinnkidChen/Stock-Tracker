import { LongbridgeProvider } from '../longbridge';

const mockCandlesticks = jest.fn();
const mockQuoteContextNew = jest.fn();

jest.mock('longport', () => ({
  Config: {
    fromEnv: jest.fn(() => ({}))
  },
  QuoteContext: {
    new: (...args: unknown[]) => mockQuoteContextNew(...args)
  },
  AdjustType: {},
  Period: {},
  TradeSessions: {}
}));

jest.mock('../../logger', () => ({
  logger: {
    error: jest.fn()
  }
}));

describe('LongbridgeProvider.getKLines', () => {
  const originalEnv = {
    LONGPORT_APP_KEY: process.env.LONGPORT_APP_KEY,
    LONGPORT_APP_SECRET: process.env.LONGPORT_APP_SECRET,
    LONGPORT_ACCESS_TOKEN: process.env.LONGPORT_ACCESS_TOKEN
  };

  beforeEach(() => {
    process.env.LONGPORT_APP_KEY = 'app-key';
    process.env.LONGPORT_APP_SECRET = 'app-secret';
    process.env.LONGPORT_ACCESS_TOKEN = 'token';

    mockCandlesticks.mockReset();
    mockQuoteContextNew.mockReset();
    mockQuoteContextNew.mockResolvedValue({
      candlesticks: mockCandlesticks
    });
  });

  afterAll(() => {
    process.env.LONGPORT_APP_KEY = originalEnv.LONGPORT_APP_KEY;
    process.env.LONGPORT_APP_SECRET = originalEnv.LONGPORT_APP_SECRET;
    process.env.LONGPORT_ACCESS_TOKEN = originalEnv.LONGPORT_ACCESS_TOKEN;
  });

  it.each([
    ['day', 14],
    ['week', 15],
    ['month', 16],
    ['year', 18]
  ] as const)(
    'maps the %s interval to Longbridge period %i',
    async (interval, expectedPeriod) => {
      mockCandlesticks.mockResolvedValue([
        {
          timestamp: new Date('2024-01-02T00:00:00.000Z'),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000
        }
      ]);

      const provider = new LongbridgeProvider();
      const series = await provider.getKLines('AAPL', interval);

      expect(mockCandlesticks).toHaveBeenCalledWith(
        'AAPL.US',
        expectedPeriod,
        1000,
        1,
        1
      );
      expect(series.range.interval).toBe(interval);
      expect(series.symbol).toBe('AAPL');
    }
  );

  it('defaults to the day interval when none is provided', async () => {
    mockCandlesticks.mockResolvedValue([]);

    const provider = new LongbridgeProvider();
    await provider.getKLines('AAPL');

    expect(mockCandlesticks).toHaveBeenCalledWith('AAPL.US', 14, 1000, 1, 1);
  });
});
