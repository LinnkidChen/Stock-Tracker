/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useKlineSeries } from '../useKlineSeries';

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_context: any, callback: any) =>
    callback({ setAttribute: jest.fn() })
  ),
  captureException: jest.fn()
}));

function TestHarness({ symbol }: { symbol?: string }) {
  const { data, isLoading, noData } = useKlineSeries(symbol);

  return (
    <div>
      <div data-testid='loading'>{String(isLoading)}</div>
      <div data-testid='symbol'>{data?.symbol ?? ''}</div>
      <div data-testid='count'>{String(data?.candles.length ?? 0)}</div>
      <div data-testid='no-data'>{String(noData)}</div>
    </div>
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...utils, queryClient };
}

describe('useKlineSeries', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads kline series successfully', async () => {
    const mockSeries = {
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

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: mockSeries })
    })) as any;

    renderWithClient(<TestHarness symbol='AAPL' />);

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('symbol')).toHaveTextContent('AAPL');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stocks/kline/AAPL',
      expect.any(Object)
    );
  });

  it('exposes loading state while request is in flight', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as any;

    renderWithClient(<TestHarness symbol='AAPL' />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('refetches when ticker changes', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const symbol = String(input).split('/').pop()!;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            symbol,
            range: {
              startDate: '2023-01-01T00:00:00.000Z',
              endDate: '2024-01-01T00:00:00.000Z',
              interval: '1d'
            },
            candles: [],
            lastUpdated: '2024-01-01T00:00:00.000Z'
          }
        })
      } as any;
    }) as any;

    const { rerender, queryClient } = renderWithClient(
      <TestHarness symbol='AAPL' />
    );

    await waitFor(() =>
      expect(screen.getByTestId('symbol')).toHaveTextContent('AAPL')
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <TestHarness symbol='MSFT' />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('symbol')).toHaveTextContent('MSFT')
    );

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stocks/kline/AAPL',
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stocks/kline/MSFT',
      expect.any(Object)
    );
  });
});
