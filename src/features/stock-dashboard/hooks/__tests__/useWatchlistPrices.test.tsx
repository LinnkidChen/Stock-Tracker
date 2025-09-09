/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWatchlistPrices } from '../useWatchlistPrices';

function TestHarness({ symbols }: { symbols: string[] }) {
  const { pricesMap, isLoading, hasErrors, errorSymbols, refetch } =
    useWatchlistPrices(symbols);

  return (
    <div>
      <pre id='prices'>{JSON.stringify(pricesMap)}</pre>
      <div id='isLoading'>{String(isLoading)}</div>
      <div id='hasErrors'>{String(hasErrors)}</div>
      <pre id='errorSymbols'>{JSON.stringify(errorSymbols)}</pre>
      <button id='refetch' onClick={() => refetch()}>
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
  return { container, unmount: () => root.unmount(), queryClient };
}

async function waitFor(predicate: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: condition not met in time');
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
      try {
        // If fake timers are active, advance a bit
        // @ts-ignore
        jest.advanceTimersByTime(5);
      } catch {}
      await Promise.resolve();
    });
  }
}

function mockApiResponse(symbol: string, ok = true, dataOverride?: any) {
  const baseQuote = {
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
  };
  return {
    ok,
    json: async () =>
      ok
        ? { success: true, data: { ...baseQuote, ...(dataOverride || {}) } }
        : { success: false, data: null, error: { code: 'X', message: 'bad' } }
  } as any;
}

describe('useWatchlistPrices', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('successful batch fetching maps prices for all symbols', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const s = String(url).split('/').pop()!;
      if (s.includes('?')) {
        // not expected here
      }
      return mockApiResponse(s);
    }) as any;

    const { container, unmount } = renderWithClient(
      <TestHarness symbols={['AAPL', 'MSFT']} />
    );

    // wait for async queries to settle
    await waitFor(
      () => container.querySelector('#isLoading')!.textContent === 'false'
    );

    const prices = JSON.parse(
      container.querySelector('#prices')!.textContent || '{}'
    );
    expect(Object.keys(prices).sort()).toEqual(['AAPL', 'MSFT']);
    expect(container.querySelector('#isLoading')!.textContent).toBe('false');
    expect(container.querySelector('#hasErrors')!.textContent).toBe('false');

    unmount();
  });

  test('handles individual symbol failures and records errorSymbols', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const s = String(url).split('/').pop()!;
      if (s === 'BAD') return mockApiResponse(s, false);
      return mockApiResponse(s);
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
    expect(Object.keys(prices)).toEqual(['GOOD']);
    const errors = JSON.parse(
      container.querySelector('#errorSymbols')!.textContent || '[]'
    );
    expect(errors).toEqual(['BAD']);
    expect(container.querySelector('#hasErrors')!.textContent).toBe('true');

    unmount();
  }, 20000);

  test('uses cache (staleTime) and avoids immediate refetch', async () => {
    const mockFetch = jest.fn(async (url: RequestInfo | URL) => {
      const s = String(url).split('/').pop()!;
      return mockApiResponse(s);
    });
    global.fetch = mockFetch as any;

    const { unmount, queryClient } = renderWithClient(
      <TestHarness symbols={['AAPL']} />
    );
    await waitFor(() => {
      const prices = queryClient.getQueryData<any>(['stock-quote', 'AAPL']);
      return Boolean(prices);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    unmount();

    // Re-render with same client and symbol should use fresh cache
    const container2 = document.createElement('div');
    document.body.appendChild(container2);
    const root2 = createRoot(container2);
    act(() => {
      root2.render(
        <QueryClientProvider client={queryClient}>
          <TestHarness symbols={['AAPL']} />
        </QueryClientProvider>
      );
    });
    await waitFor(() => {
      const prices = queryClient.getQueryData<any>(['stock-quote', 'AAPL']);
      return Boolean(prices);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    root2.unmount();
  });

  test('cleans up long-running requests via abort on timeout after unmount', async () => {
    jest.useFakeTimers();
    const abort = jest.fn();
    // Mock AbortController used inside hook fetcher
    const originalAbortController = global.AbortController as any;
    (global as any).AbortController = jest.fn(() => ({
      signal: {},
      abort
    }));

    // Never-resolving fetch to simulate hang
    global.fetch = jest.fn(() => new Promise(() => {})) as any;

    const { unmount } = renderWithClient(<TestHarness symbols={['SLOW']} />);

    // Unmount immediately then advance timers to trigger abort
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(10000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(abort).toHaveBeenCalledTimes(1);

    // Restore
    (global as any).AbortController = originalAbortController;
    jest.useRealTimers();
  });
});
