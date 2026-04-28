/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistCard } from '../WatchlistCard';

// Mock fetch
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('WatchlistCard Persistence Integration', () => {
  test('loads watchlist from API on mount', async () => {
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (typeof url === 'string' && url.endsWith('/api/watchlist')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { watchlist: ['MSFT', 'GOOGL'] }
            })
        });
      }
      if (typeof url === 'string' && url.includes('/api/stocks/quote/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { price: 150, change: 1, changePercent: 0.5 }
            })
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    renderWithProviders(<WatchlistCard />);

    // Should call GET /api/watchlist
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/watchlist',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Should display loaded symbols
    await waitFor(() => {
      expect(screen.getByText('MSFT')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });
  });

  test('removes symbol from watchlist via API', async () => {
    (global.fetch as jest.Mock).mockImplementation((url, init) => {
      if (url.endsWith('/api/watchlist')) {
        if (!init || !init.method || init.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ success: true, data: { watchlist: ['MSFT'] } })
          });
        }
        if (init.method === 'POST') {
          const body = JSON.parse(init.body as string);
          if (body.action === 'remove' && body.symbol === 'MSFT') {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({ success: true, data: { watchlist: [] } })
            });
          }
        }
      }
      if (url.includes('/api/stocks/quote/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { price: 150, change: 1, changePercent: 0.5 }
            })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    renderWithProviders(<WatchlistCard />);

    // Wait for load
    await waitFor(() => expect(screen.getByText('MSFT')).toBeInTheDocument());

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    await user.click(removeBtn);

    // Verify removal
    await waitFor(() =>
      expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
    );
  });
});
