/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChartPageClient } from '../ChartPageClient';
import { useDashboardStore } from '../../store';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DEFAULT_CHART_WORKSPACE,
  type ChartPreferences,
  type ChartRange
} from '../../lib/chart-workspace';
import type { KLineInterval } from '@/lib/types/stock-api';

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
    range,
    onIntervalChange,
    onRangeChange,
    onPreferencesChange
  }: {
    ticker: string;
    interval: KLineInterval;
    range: ChartRange;
    preferences: ChartPreferences;
    onIntervalChange?: (interval: KLineInterval) => void;
    onRangeChange?: (range: ChartRange) => void;
    onPreferencesChange?: (preferences: Partial<ChartPreferences>) => void;
  }) => (
    <div>
      <div data-testid='kline-chart'>{`${ticker}:${interval}:${range}`}</div>
      <button type='button' onClick={() => onIntervalChange?.('year')}>
        Switch Interval
      </button>
      <button type='button' onClick={() => onRangeChange?.('6m')}>
        Switch Range
      </button>
      <button
        type='button'
        onClick={() => onPreferencesChange?.({ showGrid: false })}
      >
        Toggle Grid
      </button>
    </div>
  )
}));

function createSearchParams(params: Record<string, string | null>) {
  return {
    get: (key: string) => params[key] ?? null,
    toString: () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null) {
          searchParams.set(key, value);
        }
      });
      return searchParams.toString();
    }
  };
}

function createStore(overrides: Record<string, unknown> = {}) {
  return {
    selectedTicker: null,
    setSelectedTicker: jest.fn(),
    quoteProvider: 'default',
    hydrateFromStorage: jest.fn(),
    chartWorkspace: DEFAULT_CHART_WORKSPACE,
    setChartWorkspace: jest.fn(),
    setChartPreferences: jest.fn(),
    ...overrides
  };
}

describe('ChartPageClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('replaces the symbol query param when searching from the charts page and preserves the interval and range', () => {
    const replace = jest.fn();
    const store = createStore({
      selectedTicker: 'GOOGL',
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'GOOGL',
        interval: 'week',
        range: '3m'
      }
    });

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({
        symbol: 'GOOGL',
        interval: 'week',
        range: '3m'
      })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(store);

    render(<ChartPageClient />);

    fireEvent.change(screen.getByLabelText('Enter stock ticker symbol'), {
      target: { value: 'AAPL' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(replace).toHaveBeenLastCalledWith(
      '/dashboard/charts?symbol=AAPL&interval=week&range=3m'
    );
    expect(store.setSelectedTicker).not.toHaveBeenCalled();
  });

  test('passes the selected interval and range from the URL into the chart', () => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({
        symbol: 'GOOGL',
        interval: 'month',
        range: '6m'
      })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      selectedTicker: 'GOOGL',
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'AAPL',
        interval: 'day',
        range: '1m'
      }
    }));

    render(<ChartPageClient />);

    expect(screen.getByTestId('kline-chart')).toHaveTextContent(
      'GOOGL:month:6m'
    );
  });

  test('defaults the chart interval and range when the URL omits them', () => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({ symbol: 'AAPL' })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      selectedTicker: 'AAPL',
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'AAPL'
      }
    }));

    render(<ChartPageClient />);

    expect(screen.getByTestId('kline-chart')).toHaveTextContent('AAPL:day:1y');
  });

  test('hydrates missing URL workspace fields from the store', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(createSearchParams({}));
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'NVDA',
        interval: 'month',
        range: '3m'
      }
    }));

    render(<ChartPageClient />);

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/charts?symbol=NVDA&interval=month&range=3m'
    );
  });

  test('preserves the symbol and range when the chart interval changes', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      selectedTicker: 'MSFT',
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      }
    }));

    render(<ChartPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch Interval' }));

    expect(replace).toHaveBeenLastCalledWith(
      '/dashboard/charts?symbol=MSFT&interval=year&range=3m'
    );
  });

  test('preserves the symbol and interval when the chart range changes', () => {
    const replace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      selectedTicker: 'MSFT',
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      }
    }));

    render(<ChartPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch Range' }));

    expect(replace).toHaveBeenLastCalledWith(
      '/dashboard/charts?symbol=MSFT&interval=week&range=6m'
    );
  });

  test('persists preference changes without adding preferences to the URL', () => {
    const replace = jest.fn();
    const setChartPreferences = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(
      createSearchParams({
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      })
    );
    (useDashboardStore as unknown as jest.Mock).mockReturnValue(createStore({
      selectedTicker: 'MSFT',
      setChartPreferences,
      chartWorkspace: {
        ...DEFAULT_CHART_WORKSPACE,
        symbol: 'MSFT',
        interval: 'week',
        range: '3m'
      }
    }));

    render(<ChartPageClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Grid' }));

    expect(setChartPreferences).toHaveBeenCalledWith({ showGrid: false });
    expect(replace).not.toHaveBeenCalled();
  });
});
