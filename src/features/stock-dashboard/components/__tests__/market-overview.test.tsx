/**
 * @jest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MarketOverview } from '../MarketOverview';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('MarketOverview', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows setup-specific messaging for missing Longbridge credentials', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Longbridge credentials not configured'
        }
      })
    });

    renderWithProviders(<MarketOverview />);

    expect(
      await screen.findByText('Market data setup required')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open operations/i })
    ).toHaveAttribute('href', '/dashboard/operations');
  });
});
