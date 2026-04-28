/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistCard } from '../WatchlistCard';
import type { WatchlistItem } from '@/types/watchlist';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...utils, queryClient };
}

function createItem(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: 'item-1',
    symbol: 'AAPL',
    exchange: null,
    note: null,
    sort_order: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function watchlistResponse(items: WatchlistItem[]) {
  return {
    success: true,
    data: {
      watchlist: items.map((item) => item.symbol),
      items
    }
  };
}

function quoteResponse() {
  return {
    success: true,
    data: {
      price: 100,
      change: 1,
      changePercent: 1,
      lastUpdated: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('WatchlistCard initial load', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('fetches watchlist from API on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => watchlistResponse([createItem({ symbol: 'AAPL' })])
    });

    renderWithProviders(<WatchlistCard />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/watchlist',
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });
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

  test('shows actionable empty state and adds a suggested symbol', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/api/watchlist')) {
          if (!init || !init.method || init.method === 'GET') {
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { watchlist: [] }
              })
            } as any;
          }

          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { watchlist: ['AAPL'] }
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
                lastUpdated: '2026-04-28T00:00:00.000Z'
              }
            })
          } as any;
        }

        throw new Error('Unexpected URL ' + url);
      }
    );

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    expect(await screen.findByText('Build your watchlist')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AAPL' }));

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
  });

  test('shows setup-specific state when watchlist auth is misconfigured', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: 'WATCHLIST_AUTH_MISCONFIGURED',
          message: 'Watchlist authentication is not configured on the server.'
        }
      })
    });

    renderWithProviders(<WatchlistCard />);

    expect(
      await screen.findByText('Watchlist setup required')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open operations/i })
    ).toHaveAttribute('href', '/dashboard/operations');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
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
    jest.useRealTimers();
  });

  test('shows validation modal and preserves input for invalid symbol', async () => {
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.endsWith('/api/watchlist')) {
        return Promise.resolve({
          ok: true,
          json: async () => watchlistResponse([])
        });
      }
      return Promise.resolve({ ok: true });
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/watchlist',
        expect.objectContaining({ signal: expect.any(Object) })
      )
    );
    (global.fetch as jest.Mock).mockClear();

    const input = screen.getByPlaceholderText(
      'Add symbol (1-5 letters, e.g., MSFT)'
    );
    await user.type(input, 'AAPL1');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(await screen.findByText('Invalid symbol')).toBeInTheDocument();
    expect(
      screen.getByText('Ticker symbol must contain only letters')
    ).toBeInTheDocument();
    expect(input).toHaveValue('AAPL1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('shows duplicate modal and does not re-add the symbol', async () => {
    const watchlist: WatchlistItem[] = [];
    let addCalls = 0;

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist')) {
          if (!init || !init.method || init.method === 'GET') {
            return {
              ok: true,
              json: async () => watchlistResponse(watchlist)
            } as any;
          }
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          if (body.action === 'add') {
            addCalls += 1;
            if (!watchlist.some((item) => item.symbol === body.symbol)) {
              watchlist.push(createItem({ symbol: body.symbol }));
            }
          } else if (body.action === 'remove') {
            const idx = watchlist.findIndex(
              (item) => item.symbol === body.symbol
            );
            if (idx >= 0) watchlist.splice(idx, 1);
          }
          return {
            ok: true,
            json: async () => watchlistResponse(watchlist)
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return {
            ok: true,
            json: async () => quoteResponse()
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
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    await screen.findByText('AAPL');

    await user.type(
      screen.getByPlaceholderText('Add symbol (1-5 letters, e.g., MSFT)'),
      'AAPL'
    );
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

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
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
    expect(
      screen.getByText('You are adding symbols too quickly.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('MSFT');
  });

  test('shows network modal when the request fails', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist') && (!init || !init.method)) {
        return {
          ok: true,
          json: async () => watchlistResponse([])
        } as any;
      }
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
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(await screen.findByText('Connection issue')).toBeInTheDocument();
    expect(
      screen.getByText('We could not reach the server.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('TSLA');
  });
});

describe('WatchlistCard groups and metadata', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('renders exchange groups with notes and sorted rows', async () => {
    const items = [
      createItem({
        id: 'item-msft',
        symbol: 'MSFT',
        exchange: 'NASDAQ',
        note: 'Cloud',
        sort_order: 1
      }),
      createItem({
        id: 'item-rio',
        symbol: 'RIO',
        exchange: null,
        note: 'Materials',
        sort_order: 0
      }),
      createItem({
        id: 'item-aapl',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        note: 'Core',
        sort_order: 0
      })
    ];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: true,
          json: async () => watchlistResponse(items)
        } as any;
      }
      if (url.includes('/api/stocks/quote/')) {
        return {
          ok: true,
          json: async () => quoteResponse()
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    renderWithProviders(<WatchlistCard />);

    expect(
      await screen.findByRole('heading', { name: 'NASDAQ' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ungrouped' })
    ).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Cloud')).toBeInTheDocument();

    const symbols = screen
      .getAllByText(/^(AAPL|MSFT|RIO)$/)
      .map((node) => node.textContent);
    expect(symbols).toEqual(['AAPL', 'MSFT', 'RIO']);
  });

  test('adds a symbol with exchange and note metadata', async () => {
    let postBody: any = null;
    const nextItems = [
      createItem({
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        note: 'Core holding'
      })
    ];

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist') && (!init || !init.method)) {
          return {
            ok: true,
            json: async () => watchlistResponse([])
          } as any;
        }
        if (url.endsWith('/api/watchlist') && init?.method === 'POST') {
          postBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => watchlistResponse(nextItems)
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return {
            ok: true,
            json: async () => quoteResponse()
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('Build your watchlist');
    await user.type(
      screen.getByPlaceholderText('Add symbol (1-5 letters, e.g., MSFT)'),
      'aapl'
    );
    await user.type(screen.getByPlaceholderText('Exchange'), 'nasdaq');
    await user.type(screen.getByPlaceholderText('Note'), 'Core holding');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    await waitFor(() =>
      expect(postBody).toEqual({
        action: 'add',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        note: 'Core holding'
      })
    );
  });

  test('edits existing item metadata', async () => {
    let patchBody: any = null;
    const initialItems = [createItem({ symbol: 'AAPL', exchange: 'NASDAQ' })];
    const updatedItems = [
      createItem({
        symbol: 'AAPL',
        exchange: 'NYSE',
        note: 'Dividend watch'
      })
    ];

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist') && (!init || !init.method)) {
          return {
            ok: true,
            json: async () => watchlistResponse(initialItems)
          } as any;
        }
        if (url.endsWith('/api/watchlist') && init?.method === 'PATCH') {
          patchBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => watchlistResponse(updatedItems)
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return {
            ok: true,
            json: async () => quoteResponse()
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('AAPL');
    await user.click(screen.getByRole('button', { name: /edit aapl/i }));

    const dialog = screen.getByRole('dialog');
    const exchangeInput = within(dialog).getByLabelText('Exchange');
    const noteInput = within(dialog).getByLabelText('Note');
    await user.clear(exchangeInput);
    await user.type(exchangeInput, 'nyse');
    await user.type(noteInput, 'Dividend watch');
    await user.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(patchBody).toEqual({
        action: 'update',
        symbol: 'AAPL',
        exchange: 'NYSE',
        note: 'Dividend watch'
      })
    );
  });

  test('reorders rows inside an exchange group', async () => {
    let patchBody: any = null;
    const initialItems = [
      createItem({
        id: 'item-aapl',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        sort_order: 0
      }),
      createItem({
        id: 'item-msft',
        symbol: 'MSFT',
        exchange: 'NASDAQ',
        sort_order: 1
      })
    ];
    const reorderedItems = [
      { ...initialItems[1], sort_order: 0 },
      { ...initialItems[0], sort_order: 1 }
    ];

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist') && (!init || !init.method)) {
          return {
            ok: true,
            json: async () => watchlistResponse(initialItems)
          } as any;
        }
        if (url.endsWith('/api/watchlist') && init?.method === 'PATCH') {
          patchBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => watchlistResponse(reorderedItems)
          } as any;
        }
        if (url.includes('/api/stocks/quote/')) {
          return {
            ok: true,
            json: async () => quoteResponse()
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('MSFT');
    await user.click(screen.getByRole('button', { name: /move msft up/i }));

    await waitFor(() =>
      expect(patchBody).toEqual({
        action: 'reorder',
        items: [
          { symbol: 'MSFT', sort_order: 0 },
          { symbol: 'AAPL', sort_order: 1 }
        ]
      })
    );
  });

  test('manual refresh button refetches watchlist prices', async () => {
    const items = [createItem({ symbol: 'AAPL' })];
    let quoteCalls = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: true,
          json: async () => watchlistResponse(items)
        } as any;
      }
      if (url.includes('/api/stocks/quote/')) {
        quoteCalls += 1;
        return {
          ok: true,
          json: async () => quoteResponse()
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('AAPL');
    await waitFor(() => expect(quoteCalls).toBe(1));

    await user.click(
      screen.getByRole('button', { name: /refresh watchlist prices/i })
    );

    await waitFor(() => expect(quoteCalls).toBe(2));
  });

  test('disables refresh button while price refresh is in progress', async () => {
    const items = [createItem({ symbol: 'AAPL' })];
    let quoteCalls = 0;
    let resolveRefresh: (() => void) | null = null;

    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return Promise.resolve({
          ok: true,
          json: async () => watchlistResponse(items)
        }) as any;
      }
      if (url.includes('/api/stocks/quote/')) {
        quoteCalls += 1;
        if (quoteCalls === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => quoteResponse()
          }) as any;
        }

        return new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({
              ok: true,
              json: async () => quoteResponse()
            });
        }) as any;
      }
      return Promise.reject(new Error('Unexpected URL ' + url));
    }) as any;

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('AAPL');
    await waitFor(() => expect(quoteCalls).toBe(1));

    const refreshButton = screen.getByRole('button', {
      name: /refresh watchlist prices/i
    });
    await user.click(refreshButton);

    await waitFor(() => expect(refreshButton).toBeDisabled());
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();

    resolveRefresh?.();
    await waitFor(() => expect(refreshButton).not.toBeDisabled());
  });

  test('auto refresh switch enables 60-second price polling', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const items = [createItem({ symbol: 'AAPL' })];
    let quoteCalls = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: true,
          json: async () => watchlistResponse(items)
        } as any;
      }
      if (url.includes('/api/stocks/quote/')) {
        quoteCalls += 1;
        return {
          ok: true,
          json: async () => quoteResponse()
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime
    });
    renderWithProviders(<WatchlistCard />);

    await screen.findByText('AAPL');
    await waitFor(() => expect(quoteCalls).toBe(1));

    await user.click(
      screen.getByRole('switch', { name: /auto refresh watchlist/i })
    );

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(quoteCalls).toBe(2);
  });

  test('shows stale markers when quote data is older than 60 seconds', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const items = [createItem({ symbol: 'AAPL' })];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/watchlist')) {
        return {
          ok: true,
          json: async () => watchlistResponse(items)
        } as any;
      }
      if (url.includes('/api/stocks/quote/')) {
        return {
          ok: true,
          json: async () => quoteResponse()
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    }) as any;

    renderWithProviders(<WatchlistCard />);

    await screen.findByText('AAPL');
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();

    jest.setSystemTime(new Date('2026-01-01T00:01:01.000Z'));
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('Some quotes stale')).toBeInTheDocument();
  });
});
