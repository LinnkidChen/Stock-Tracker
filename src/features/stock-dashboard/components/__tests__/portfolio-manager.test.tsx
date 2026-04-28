/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioManager } from '../PortfolioManager';

jest.mock('../../hooks/useWatchlistPrices', () => ({
  useWatchlistPrices: jest.fn(() => ({
    pricesMap: {},
    isLoading: false,
    hasErrors: false,
    errorSymbols: [],
    refetch: jest.fn()
  }))
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
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

describe('PortfolioManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === '/api/portfolio/holdings') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                holdings: [],
                summary: {
                  currency: 'USD',
                  cashBalance: 0,
                  holdingsCount: 0,
                  investedCost: 0,
                  realizedPnl: 0,
                  dividends: 0,
                  fees: 0,
                  deposits: 0,
                  withdrawals: 0
                }
              }
            })
          } as any;
        }

        if (url === '/api/portfolio/transactions' && !init?.method) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                transactions: [],
                summary: {
                  currency: 'USD',
                  cashBalance: 0,
                  holdingsCount: 0,
                  investedCost: 0,
                  realizedPnl: 0,
                  dividends: 0,
                  fees: 0,
                  deposits: 0,
                  withdrawals: 0
                }
              }
            })
          } as any;
        }

        if (url === '/api/portfolio/transactions' && init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              data: {
                transaction: {
                  id: 'transaction_1',
                  type: 'buy',
                  symbol: 'AAPL'
                },
                holdings: [],
                summary: {}
              }
            })
          } as any;
        }

        throw new Error(`Unexpected request ${url}`);
      }
    ) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('submits a buy transaction through the ledger API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortfolioManager />);

    await screen.findByText(
      'No holdings yet. Add a buy or opening balance transaction.'
    );
    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    await user.type(screen.getByLabelText('Symbol'), 'aapl');
    await user.type(screen.getByLabelText('Quantity'), '10');
    await user.type(screen.getByLabelText('Price'), '150');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/portfolio/transactions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"symbol":"AAPL"')
        })
      );
    });
  });
});
