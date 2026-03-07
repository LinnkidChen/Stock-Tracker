/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useKlineSeries } from '../useKlineSeries';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import type { KLineInterval } from '@/lib/types/stock-api';

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_context: unknown, callback: any) =>
    callback({ setAttribute: jest.fn() })
  ),
  captureException: jest.fn()
}));

function TestHarness({
  symbol,
  provider = CANONICAL_QUOTE_PROVIDER,
  interval = 'day'
}: {
  symbol?: string;
  provider?: string;
  interval?: KLineInterval;
}) {
  const { data, isLoading, noData } = useKlineSeries(
    symbol,
    provider,
    interval
  );

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

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('useKlineSeries', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads kline series using the canonical provider query string', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');

      expect(url.pathname).toBe('/api/stocks/kline/AAPL');
      expect(url.searchParams.get('provider')).toBe(CANONICAL_QUOTE_PROVIDER);
      expect(url.searchParams.get('interval')).toBe('day');

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
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
          }
        })
      } as any;
    }) as any;

    renderWithClient(<TestHarness symbol='AAPL' />);

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('symbol')).toHaveTextContent('AAPL');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('exposes loading state while request is in flight', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as any;

    renderWithClient(<TestHarness symbol='AAPL' />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('refetches when the interval changes', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const interval = url.searchParams.get('interval') || '';

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            symbol: interval,
            range: {
              startDate: '2023-01-01T00:00:00.000Z',
              endDate: '2024-01-01T00:00:00.000Z',
              interval: interval as KLineInterval
            },
            candles: [],
            lastUpdated: '2024-01-01T00:00:00.000Z'
          }
        })
      } as any;
    }) as any;

    const { rerender } = renderWithClient(
      <TestHarness symbol='AAPL' interval='day' />
    );

    await waitFor(() =>
      expect(screen.getByTestId('symbol')).toHaveTextContent('day')
    );

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0 } }
          })
        }
      >
        <TestHarness symbol='AAPL' interval='week' />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('symbol')).toHaveTextContent('week')
    );
  });
});
