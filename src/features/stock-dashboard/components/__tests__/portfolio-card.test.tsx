/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { PortfolioCard } from '../PortfolioCard';
import type { PortfolioHolding, PortfolioSummary } from '@/types/portfolio';

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

const originalFetch = global.fetch as any;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

function makeHolding(overrides: Partial<PortfolioHolding> = {}) {
  return {
    id: 'user_123:AAPL',
    userId: 'user_123',
    symbol: 'AAPL',
    quantity: 10,
    avgCost: 150,
    costBasis: 1500,
    realizedPnl: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  };
}

const summary: PortfolioSummary = {
  currency: 'USD',
  cashBalance: -1500,
  holdingsCount: 1,
  investedCost: 1500,
  realizedPnl: 125,
  dividends: 0,
  fees: 0,
  deposits: 0,
  withdrawals: 0
};

function mockPortfolioFetch(holdings: PortfolioHolding[]) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/portfolio/holdings') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            holdings,
            summary: { ...summary, holdingsCount: holdings.length }
          }
        })
      } as any;
    }

    throw new Error(`Unexpected request ${url}`);
  }) as any;
}

describe('PortfolioCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('loads derived holdings and renders summary totals', async () => {
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

    renderWithProviders(<PortfolioCard />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('$1,750.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('$125.00')).toBeInTheDocument();
    expect(screen.getByText('$375.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/dashboard/portfolio'
    );
  });

  it('shows the empty ledger state when no holdings exist', async () => {
    mockPortfolioFetch([]);

    renderWithProviders(<PortfolioCard />);

    expect(
      await screen.findByText(
        'No ledger transactions yet. Open Portfolio to add one.'
      )
    ).toBeInTheDocument();
  });
});
