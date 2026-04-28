/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioCard } from '../PortfolioCard';
import type { PortfolioHolding } from '@/types/portfolio';

let mockUseWatchlistPricesResult = {
  pricesMap: {},
  isLoading: false,
  hasErrors: false,
  errorSymbols: [],
  refetch: jest.fn()
};

jest.mock('../../hooks/useWatchlistPrices', () => ({
  useWatchlistPrices: jest.fn(() => mockUseWatchlistPricesResult)
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

const originalFetch = global.fetch as any;

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeHolding(overrides: Partial<PortfolioHolding> = {}) {
  return {
    id: 'holding_1',
    userId: 'user_123',
    symbol: 'AAPL',
    quantity: 10,
    avgCost: 150,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  };
}

function mockPortfolioFetch(holdings: PortfolioHolding[]) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === '/api/portfolio/holdings' && !init?.method) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { holdings }
        })
      } as any;
    }

    throw new Error(`Unexpected request ${url}`);
  }) as any;
}

describe('PortfolioCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).ResizeObserver = MockResizeObserver;
    mockUseWatchlistPricesResult = {
      pricesMap: {},
      isLoading: false,
      hasErrors: false,
      errorSymbols: [],
      refetch: jest.fn()
    };
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads persisted holdings and renders quote-driven totals', async () => {
    mockUseWatchlistPricesResult = {
      pricesMap: {
        AAPL: {
          price: 175,
          change: 2,
          changePercent: 1.16,
          lastUpdated: new Date('2026-01-03T00:00:00.000Z')
        }
      },
      isLoading: false,
      hasErrors: false,
      errorSymbols: [],
      refetch: jest.fn()
    };
    mockPortfolioFetch([makeHolding()]);

    render(<PortfolioCard />);

    await screen.findByText('AAPL');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/portfolio/holdings',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(screen.getAllByText('$1,750.00').length).toBeGreaterThan(0);
    expect(screen.getByText('$250.00 (+16.67%)')).toBeInTheDocument();
    expect(screen.getByText('$20.00 (+1.16%)')).toBeInTheDocument();
  });

  it('shows the empty state when no holdings exist', async () => {
    mockPortfolioFetch([]);

    render(<PortfolioCard />);

    expect(
      await screen.findByText(
        'No holdings yet. Add a position to see your portfolio overview.'
      )
    ).toBeInTheDocument();
  });

  it('adds a holding through the API', async () => {
    const saved = makeHolding();
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === '/api/portfolio/holdings' && !init?.method) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { holdings: [] } })
          } as any;
        }

        if (url === '/api/portfolio/holdings' && init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { holding: saved } })
          } as any;
        }

        throw new Error(`Unexpected request ${url}`);
      }
    ) as any;

    const user = userEvent.setup();
    render(<PortfolioCard />);

    await screen.findByText(
      'No holdings yet. Add a position to see your portfolio overview.'
    );
    await user.click(screen.getByRole('button', { name: /add position/i }));
    await user.type(screen.getByLabelText('Symbol'), 'aapl');
    await user.type(screen.getByLabelText('Quantity'), '10');
    await user.type(screen.getByLabelText('Average Cost'), '150');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await screen.findByText('AAPL');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/portfolio/holdings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          symbol: 'AAPL',
          quantity: 10,
          avgCost: 150
        })
      })
    );
  });

  it('validates holding form values before saving', async () => {
    mockPortfolioFetch([]);
    const user = userEvent.setup();
    render(<PortfolioCard />);

    await screen.findByText(
      'No holdings yet. Add a position to see your portfolio overview.'
    );
    await user.click(screen.getByRole('button', { name: /add position/i }));
    await user.type(screen.getByLabelText('Symbol'), 'AAPL');
    await user.type(screen.getByLabelText('Quantity'), '0');
    await user.type(screen.getByLabelText('Average Cost'), '150');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(
      await screen.findByText('Quantity must be greater than 0')
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows duplicate errors from the create API', async () => {
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === '/api/portfolio/holdings' && !init?.method) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { holdings: [] } })
          } as any;
        }

        if (url === '/api/portfolio/holdings' && init?.method === 'POST') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              success: false,
              error: {
                message: 'Portfolio holding already exists for this symbol'
              }
            })
          } as any;
        }

        throw new Error(`Unexpected request ${url}`);
      }
    ) as any;

    const user = userEvent.setup();
    render(<PortfolioCard />);

    await screen.findByText(
      'No holdings yet. Add a position to see your portfolio overview.'
    );
    await user.click(screen.getByRole('button', { name: /add position/i }));
    await user.type(screen.getByLabelText('Symbol'), 'AAPL');
    await user.type(screen.getByLabelText('Quantity'), '10');
    await user.type(screen.getByLabelText('Average Cost'), '150');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(
      await screen.findByText('Portfolio holding already exists for this symbol')
    ).toBeInTheDocument();
  });

  it('deletes a holding after confirmation', async () => {
    const holding = makeHolding();
    mockUseWatchlistPricesResult = {
      pricesMap: {
        AAPL: {
          price: 175,
          change: 2,
          changePercent: 1.16,
          lastUpdated: new Date('2026-01-03T00:00:00.000Z')
        }
      },
      isLoading: false,
      hasErrors: false,
      errorSymbols: [],
      refetch: jest.fn()
    };
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === '/api/portfolio/holdings' && !init?.method) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { holdings: [holding] }
            })
          } as any;
        }

        if (
          url === '/api/portfolio/holdings/holding_1' &&
          init?.method === 'DELETE'
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { id: 'holding_1' }
            })
          } as any;
        }

        throw new Error(`Unexpected request ${url}`);
      }
    ) as any;

    const user = userEvent.setup();
    render(<PortfolioCard />);

    await screen.findByText('AAPL');
    await user.click(screen.getByRole('button', { name: 'Delete AAPL' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/portfolio/holdings/holding_1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('shows partial totals when a quote fails', async () => {
    mockUseWatchlistPricesResult = {
      pricesMap: {
        AAPL: {
          price: 175,
          change: 2,
          changePercent: 1.16,
          lastUpdated: new Date('2026-01-03T00:00:00.000Z')
        }
      },
      isLoading: false,
      hasErrors: true,
      errorSymbols: ['MSFT'],
      refetch: jest.fn()
    };
    mockPortfolioFetch([
      makeHolding(),
      makeHolding({
        id: 'holding_2',
        symbol: 'MSFT',
        quantity: 5,
        avgCost: 250
      })
    ]);

    render(<PortfolioCard />);

    await screen.findByText('AAPL');
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Prices unavailable for MSFT.')).toBeInTheDocument();
    expect(screen.getAllByText('$1,750.00').length).toBeGreaterThan(0);
  });
});
