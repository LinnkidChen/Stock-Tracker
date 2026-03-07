/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChartPageClient } from '../ChartPageClient';
import { useDashboardStore } from '../../store';
import { useRouter, useSearchParams } from 'next/navigation';

jest.mock('../../store', () => ({
  useDashboardStore: jest.fn()
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn()
}));

jest.mock('../QuoteProviderToggle', () => ({
  QuoteProviderToggle: () => <div>Quote Provider</div>
}));

jest.mock('../KLineChart', () => ({
  KLineChart: ({ ticker }: { ticker: string }) => (
    <div data-testid='kline-chart'>{ticker}</div>
  )
}));

describe('ChartPageClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('replaces the symbol query param when searching from the charts page', () => {
    const replace = jest.fn();
    const setSelectedTicker = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === 'symbol' ? 'GOOGL' : null),
      toString: () => 'symbol=GOOGL'
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'GOOGL',
      setSelectedTicker,
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);

    fireEvent.change(screen.getByLabelText('Enter stock ticker symbol'), {
      target: { value: 'AAPL' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(replace).toHaveBeenCalledWith('/dashboard/charts?symbol=AAPL');
    expect(setSelectedTicker).not.toHaveBeenCalled();
  });
});
