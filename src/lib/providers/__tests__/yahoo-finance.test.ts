import { YahooFinanceProvider } from '../yahoo-finance';

function createYahooResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Upstream error',
    headers: {
      get: jest.fn()
    },
    json: async () => payload
  } as unknown as Response;
}

function chartPayload(overrides: Record<string, unknown> = {}) {
  return {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            longName: 'Apple Inc.',
            regularMarketPrice: 105,
            previousClose: 100,
            regularMarketDayHigh: 110,
            regularMarketDayLow: 95,
            regularMarketOpen: 101,
            regularMarketVolume: 1234,
            regularMarketTime: 1704153600,
            ...overrides
          },
          timestamp: [1704067200, 1704153600],
          indicators: {
            quote: [
              {
                open: [100, 101],
                high: [106, 110],
                low: [99, 95],
                close: [104, 105],
                volume: [1000, 1234]
              }
            ]
          }
        }
      ],
      error: null
    }
  };
}

describe('YahooFinanceProvider', () => {
  it('transforms chart metadata into a stock quote', async () => {
    const fetchImpl = jest.fn(async () => createYahooResponse(chartPayload()));
    const provider = new YahooFinanceProvider({ fetchImpl: fetchImpl as any });

    const quote = await provider.getQuote('AAPL.US');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/AAPL?range=5d&interval=1d'),
      { cache: 'no-store' }
    );
    expect(quote).toEqual(
      expect.objectContaining({
        symbol: 'AAPL.US',
        name: 'Apple Inc.',
        price: 105,
        change: 5,
        changePercent: 5,
        volume: 1234,
        previousClose: 100,
        lastUpdated: '2024-01-02T00:00:00.000Z'
      })
    );
  });

  it('aggregates monthly candles into yearly k-line candles', async () => {
    const fetchImpl = jest.fn(async () =>
      createYahooResponse({
        chart: {
          result: [
            {
              meta: { symbol: 'AAPL' },
              timestamp: [1640995200, 1643673600, 1672531200],
              indicators: {
                quote: [
                  {
                    open: [10, 12, 20],
                    high: [15, 18, 25],
                    low: [9, 11, 19],
                    close: [14, 17, 24],
                    volume: [100, 200, 300]
                  }
                ]
              }
            }
          ],
          error: null
        }
      })
    );
    const provider = new YahooFinanceProvider({ fetchImpl: fetchImpl as any });

    const series = await provider.getKLines('AAPL', 'year');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/AAPL?range=max&interval=1mo'),
      { cache: 'no-store' }
    );
    expect(series.candles).toEqual([
      {
        timestamp: Date.UTC(2022, 0, 1),
        open: 10,
        high: 18,
        low: 9,
        close: 17,
        volume: 300
      },
      {
        timestamp: Date.UTC(2023, 0, 1),
        open: 20,
        high: 25,
        low: 19,
        close: 24,
        volume: 300
      }
    ]);
  });

  it('maps rate limits to API_LIMIT_EXCEEDED', async () => {
    const fetchImpl = jest.fn(async () =>
      createYahooResponse(
        {
          chart: {
            result: null,
            error: { code: 'Too Many Requests', description: 'rate limit' }
          }
        },
        429
      )
    );
    const provider = new YahooFinanceProvider({ fetchImpl: fetchImpl as any });

    await expect(provider.getQuote('AAPL')).rejects.toMatchObject({
      code: 'API_LIMIT_EXCEEDED'
    });
  });
});
