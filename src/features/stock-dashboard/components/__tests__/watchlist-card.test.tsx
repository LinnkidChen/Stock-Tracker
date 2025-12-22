/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistCard } from '../WatchlistCard';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...utils, queryClient };
}

describe('WatchlistCard initial load', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('fetches watchlist from API on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { watchlist: ['AAPL'] }
      })
    });

    renderWithProviders(<WatchlistCard />);

    expect(global.fetch).toHaveBeenCalledWith('/api/watchlist');
  });

  test('shows error message if load fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    renderWithProviders(<WatchlistCard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load watchlist')).toBeInTheDocument();
    });
  });
});

describe('WatchlistCard add error modal flows', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('shows validation modal and preserves input for invalid symbol', async () => {
    global.fetch = jest.fn((url) => {
      // Handle initial load
      if (typeof url === 'string' && url.endsWith('/api/watchlist')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { watchlist: [] } })
        });
      }
      return Promise.resolve({ ok: true });
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    // Wait for initial load
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/watchlist')
    );
    (global.fetch as jest.Mock).mockClear();

    const input = screen.getByPlaceholderText(
      'Add symbol (1-5 letters, e.g., MSFT)'
    );
    await user.type(input, 'AAPL1');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Invalid symbol')).toBeInTheDocument();
    expect(
      screen.getByText('Ticker symbol must contain only letters')
    ).toBeInTheDocument();
    expect(input).toHaveValue('AAPL1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('shows duplicate modal and does not re-add the symbol', async () => {
    const watchlist: string[] = [];
    let addCalls = 0;

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist')) {
          if (!init || !init.method || init.method === 'GET') {
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { watchlist: [...watchlist] }
              })
            } as any;
          }
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          if (body.action === 'add') {
            addCalls += 1;
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
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                price: 100,
                change: 1,
                changePercent: 1,
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

    await user.type(
      screen.getByPlaceholderText('Add symbol (1-5 letters, e.g., MSFT)'),
      'AAPL'
    );
    await user.click(screen.getByRole('button', { name: /add/i }));
    await screen.findByText('AAPL');

    await user.type(
      screen.getByPlaceholderText('Add symbol (1-5 letters, e.g., MSFT)'),
      'AAPL'
    );
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(
      await screen.findByText('Already in your watchlist')
    ).toBeInTheDocument();
    expect(
      screen.getByText('That symbol is already in your watchlist.')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Add symbol (1-5 letters, e.g., MSFT)')
    ).toHaveValue('AAPL');
    expect(addCalls).toBe(1);
  });

  test('shows rate limit modal for 429 responses', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            success: false,
            error: { message: 'Rate limit exceeded. Try again later.' }
          })
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    const input = screen.getByPlaceholderText(
      'Add symbol (1-5 letters, e.g., MSFT)'
    );
    await user.type(input, 'MSFT');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
    expect(
      screen.getByText('You are adding symbols too quickly.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('MSFT');
  });

  test('shows network modal when the request fails', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        throw new Error('Network down');
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    const input = screen.getByPlaceholderText(
      'Add symbol (1-5 letters, e.g., MSFT)'
    );
    await user.type(input, 'TSLA');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Connection issue')).toBeInTheDocument();
    expect(
      screen.getByText('We could not reach the server.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('TSLA');
  });

  test('shows unknown modal for unexpected server errors', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: { message: 'Unexpected server error' }
          })
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    const input = screen.getByPlaceholderText(
      'Add symbol (1-5 letters, e.g., MSFT)'
    );
    await user.type(input, 'IBM');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('We could not add that symbol.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('IBM');
  });
});
