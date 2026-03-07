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
});
