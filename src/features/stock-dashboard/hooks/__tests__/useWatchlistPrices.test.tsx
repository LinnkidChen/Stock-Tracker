/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWatchlistPrices } from '../useWatchlistPrices';
import { useDashboardStore } from '../../store';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import type { UseWatchlistPricesOptions } from '../useWatchlistPrices';

function TestHarness({
  symbols,
  options
}: {
  symbols: string[];
  options?: UseWatchlistPricesOptions;
}) {
  const {
    pricesMap,
    isLoading,
    isRefreshing,
    hasErrors,
    errorSymbols,
    staleSymbols,
    lastRefreshedAt,
    symbolMeta,
    refreshAll
  } = useWatchlistPrices(symbols, options);

  return (
    <div>
      <pre id='prices'>{JSON.stringify(pricesMap)}</pre>
      <div id='isLoading'>{String(isLoading)}</div>
      <div id='isRefreshing'>{String(isRefreshing)}</div>
      <div id='hasErrors'>{String(hasErrors)}</div>
      <pre id='errorSymbols'>{JSON.stringify(errorSymbols)}</pre>
      <pre id='staleSymbols'>{JSON.stringify(staleSymbols)}</pre>
      <pre id='symbolMeta'>{JSON.stringify(symbolMeta)}</pre>
      <div id='lastRefreshedAt'>{lastRefreshedAt?.toISOString() ?? ''}</div>
      <button id='refetch' onClick={() => void refreshAll()}>
        refetch
      </button>
    </div>
  );
}

function renderWithClient(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    );
  });

  return { container, queryClient, unmount: () => root.unmount() };
}

async function waitFor(predicate: () => boolean, timeout = 2000) {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: condition not met in time');
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await Promise.resolve();
    });
  }
}

async function waitForWithFakeTimers(
  predicate: () => boolean,
  timeout = 2000
) {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitForWithFakeTimers: condition not met in time');
    }

    await act(async () => {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
}

function mockApiResponse(symbol: string, ok = true) {
  return {
    ok,
    json: async () =>
      ok
        ? {
            success: true,
            data: {
              symbol,
              name: symbol,
              price: 100,
              change: 1,
              changePercent: 1,
              volume: 1000,
              high: 110,
              low: 90,
              open: 95,
              previousClose: 99,
              marketCap: 1,
              peRatio: 1,
              eps: 1,
              dividendYield: 0,
              week52High: 120,
              week52Low: 80,
              avgVolume: 100,
              beta: 1,
              lastUpdated: '2023-01-01T00:00:00.000Z'
            }
          }
        : {
            success: false,
            data: null,
            error: { code: 'UNKNOWN_ERROR', message: 'bad' }
          }
  } as any;
}

describe('useWatchlistPrices', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    useDashboardStore.setState({
      quoteProvider: CANONICAL_QUOTE_PROVIDER
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('fetches prices with the canonical provider query string', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      expect(url.searchParams.get('provider')).toBe(CANONICAL_QUOTE_PROVIDER);

      return mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['AAPL', 'MSFT']} />
    );

    await waitFor(
      () => container.querySelector('#isLoading')!.textContent === 'false'
    );

    const prices = JSON.parse(
      container.querySelector('#prices')!.textContent || '{}'
    );

    expect(Object.keys(prices).sort()).toEqual(['AAPL', 'MSFT']);
    expect(container.querySelector('#hasErrors')!.textContent).toBe('false');

    unmount();
  });

  test('records failed symbols without dropping successful ones', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      return symbol === 'BAD'
        ? mockApiResponse(symbol, false)
        : mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['GOOD', 'BAD']} />
    );

    await waitFor(
      () => container.querySelector('#hasErrors')!.textContent === 'true',
      15000
    );

    const prices = JSON.parse(
      container.querySelector('#prices')!.textContent || '{}'
    );
    const errors = JSON.parse(
      container.querySelector('#errorSymbols')!.textContent || '[]'
    );

    expect(Object.keys(prices)).toEqual(['GOOD']);
    expect(errors).toEqual(['BAD']);

    unmount();
  });

  test('refetches all active queries when requested', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      return mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['AAPL']} />
    );

    await waitFor(() => {
      const prices = JSON.parse(
        container.querySelector('#prices')!.textContent || '{}'
      );
      return Boolean(prices.AAPL);
    });

    act(() => {
      (container.querySelector('#refetch') as HTMLButtonElement).click();
    });

    await waitFor(() => (global.fetch as jest.Mock).mock.calls.length > 1);

    expect(global.fetch).toHaveBeenCalledTimes(2);

    unmount();
  });

  test('does not poll when auto refresh is disabled', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      return mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness
        symbols={['AAPL']}
        options={{ autoRefresh: false, refreshIntervalMs: 60_000 }}
      />
    );

    await waitForWithFakeTimers(
      () => container.querySelector('#isLoading')!.textContent === 'false'
    );

    act(() => {
      jest.advanceTimersByTime(120_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    unmount();
  });

  test('polls every 60 seconds when auto refresh is enabled', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      return mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['AAPL']} options={{ autoRefresh: true }} />
    );

    await waitForWithFakeTimers(
      () => container.querySelector('#isLoading')!.textContent === 'false'
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    unmount();
  });

  test('marks symbols stale from React Query dataUpdatedAt age', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:3000');
      const symbol = url.pathname.split('/').pop()!;

      return mockApiResponse(symbol);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['AAPL']} options={{ staleAfterMs: 60_000 }} />
    );

    await waitForWithFakeTimers(
      () => container.querySelector('#isLoading')!.textContent === 'false'
    );

    expect(container.querySelector('#staleSymbols')!.textContent).toBe('[]');
    expect(container.querySelector('#lastRefreshedAt')!.textContent).toContain(
      '2026-01-01T00:00:'
    );

    jest.setSystemTime(new Date('2026-01-01T00:01:01.000Z'));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    const staleSymbols = JSON.parse(
      container.querySelector('#staleSymbols')!.textContent || '[]'
    );
    const symbolMeta = JSON.parse(
      container.querySelector('#symbolMeta')!.textContent || '{}'
    );

    expect(staleSymbols).toEqual(['AAPL']);
    expect(symbolMeta.AAPL.isStale).toBe(true);

    unmount();
  });
});
