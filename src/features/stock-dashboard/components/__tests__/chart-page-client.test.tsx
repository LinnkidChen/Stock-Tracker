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
  KLineChart: ({
    ticker,
    interval,
    onIntervalChange
  }: {
    ticker: string;
    interval: string;
    onIntervalChange?: (interval: 'day' | 'week' | 'month' | 'year') => void;
  }) => (
    <div>
      <div data-testid='kline-chart'>{`${ticker}:${interval}`}</div>
      <button type='button' onClick={() => onIntervalChange?.('year')}>
        Switch Interval
      </button>
    </div>
  )
}));

describe('ChartPageClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('replaces the symbol query param when searching from the charts page and preserves the interval', () => {
    const replace = jest.fn();
    const setSelectedTicker = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) =>
        key === 'symbol' ? 'GOOGL' : key === 'interval' ? 'week' : null,
      toString: () => 'symbol=GOOGL&interval=week'
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

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/charts?symbol=AAPL&interval=week'
    );
    expect(setSelectedTicker).not.toHaveBeenCalled();
  });

  test('passes the selected interval from the URL into the chart', () => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) =>
        key === 'symbol' ? 'GOOGL' : key === 'interval' ? 'month' : null,
      toString: () => 'symbol=GOOGL&interval=month'
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'GOOGL',
      setSelectedTicker: jest.fn(),
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);

    expect(screen.getByTestId('kline-chart')).toHaveTextContent('GOOGL:month');
  });

  test('defaults the chart interval to day when the URL omits it', () => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === 'symbol' ? 'AAPL' : null),
      toString: () => 'symbol=AAPL'
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'AAPL',
      setSelectedTicker: jest.fn(),
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);

    expect(screen.getByTestId('kline-chart')).toHaveTextContent('AAPL:day');
  });

  test('hydrates the missing symbol in the URL from the store without dropping the interval', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === 'interval' ? 'month' : null),
      toString: () => 'interval=month'
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'NVDA',
      setSelectedTicker: jest.fn(),
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/charts?symbol=NVDA&interval=month'
    );
  });

  test('preserves the symbol when the chart interval changes', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) =>
        key === 'symbol' ? 'MSFT' : key === 'interval' ? 'week' : null,
      toString: () => 'symbol=MSFT&interval=week'
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'MSFT',
      setSelectedTicker: jest.fn(),
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch Interval' }));

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/charts?symbol=MSFT&interval=year'
    );
  });

  test('renders suggested ticker actions when no chart symbol is selected', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: () => null,
      toString: () => ''
    });
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: null,
      setSelectedTicker: jest.fn(),
      quoteProvider: 'default'
    });

    render(<ChartPageClient />);

    expect(screen.getByText('Choose a ticker')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AAPL' }));

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/charts?symbol=AAPL&interval=day'
    );
  });
});
