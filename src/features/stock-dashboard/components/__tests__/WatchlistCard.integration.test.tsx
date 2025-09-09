/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchlistCard } from '../WatchlistCard';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...utils, queryClient };
}

describe('WatchlistCard integration', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('end-to-end: empty → add symbol → price shows → remove back to empty', async () => {
    const watchlist: string[] = [];
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          if (body.action === 'add') {
            if (!watchlist.includes(body.symbol)) watchlist.push(body.symbol);
          } else if (body.action === 'remove') {
            const idx = watchlist.indexOf(body.symbol);
            if (idx >= 0) watchlist.splice(idx, 1);
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { watchlist: [...watchlist] }
            })
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          const symbol = url.split('/').pop()!;
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                symbol,
                name: symbol,
                price: 150.12,
                change: 1.23,
                changePercent: 0.82,
                volume: 0,
                high: 0,
                low: 0,
                open: 0,
                previousClose: 0,
                marketCap: 0,
                peRatio: 0,
                eps: 0,
                dividendYield: 0,
                week52High: 0,
                week52Low: 0,
                avgVolume: 0,
                beta: 0,
                lastUpdated: '2023-01-01T00:00:00.000Z'
              }
            })
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    // Initially empty
    expect(await screen.findByText('No symbols yet.')).toBeInTheDocument();

    // Add AAPL
    await user.type(
      screen.getByPlaceholderText('Add symbol (e.g., MSFT)'),
      'AAPL'
    );
    await user.click(screen.getByRole('button', { name: /add/i }));

    // Wait for PriceIndicator to show formatted price
    await screen.findByText('AAPL');
    await screen.findByText('$150.12');

    // Remove
    await user.click(screen.getByRole('button', { name: /remove/i }));
    await screen.findByText('No symbols yet.');
  });

  test('handles quote fetch error state and shows error message', async () => {
    const watchlist: string[] = [];
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          if (body.action === 'add' && !watchlist.includes(body.symbol)) {
            watchlist.push(body.symbol);
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { watchlist: [...watchlist] }
            })
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return { ok: false, status: 500, json: async () => ({}) } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await user.type(
      screen.getByPlaceholderText('Add symbol (e.g., MSFT)'),
      'BAD'
    );
    await user.click(screen.getByRole('button', { name: /add/i }));

    await screen.findByText('Failed to load price', undefined, {
      timeout: 8000
    });
  });

  test('shows loading skeleton while prices are loading', async () => {
    const watchlist: string[] = [];
    // Never resolves for first 500ms, then resolves
    let resolveQuote: ((value: any) => void) | null = null;
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          if (body.action === 'add' && !watchlist.includes(body.symbol)) {
            watchlist.push(body.symbol);
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { watchlist: [...watchlist] }
            })
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return {
            ok: true,
            json: () =>
              new Promise((resolve) => {
                resolveQuote = resolve;
                // do not resolve immediately to show loader
                setTimeout(
                  () =>
                    resolve({
                      success: true,
                      data: {
                        symbol: 'SLOW',
                        name: 'SLOW',
                        price: 42,
                        change: 0,
                        changePercent: 0,
                        volume: 0,
                        high: 0,
                        low: 0,
                        open: 0,
                        previousClose: 0,
                        marketCap: 0,
                        peRatio: 0,
                        eps: 0,
                        dividendYield: 0,
                        week52High: 0,
                        week52Low: 0,
                        avgVolume: 0,
                        beta: 0,
                        lastUpdated: '2023-01-01T00:00:00.000Z'
                      }
                    }),
                  3000
                );
              })
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    const { container } = renderWithProviders(<WatchlistCard />);

    await user.type(
      screen.getByPlaceholderText('Add symbol (e.g., MSFT)'),
      'SLOW'
    );
    await user.click(screen.getByRole('button', { name: /add/i }));

    // Skeleton should appear while loading
    await waitFor(
      () =>
        expect(
          container.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0),
      { timeout: 1500 }
    );

    // Then price shows
    expect(
      await screen.findByText('$42.00', undefined, { timeout: 6000 })
    ).toBeInTheDocument();
  });
});
