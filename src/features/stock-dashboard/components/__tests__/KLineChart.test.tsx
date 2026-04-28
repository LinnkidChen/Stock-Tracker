/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KLineChart } from '../KLineChart';
import { useKlineSeries } from '../../hooks/useKlineSeries';
import type { KLineInterval } from '@/lib/types/stock-api';
import { StockApiResponseError } from '../../lib/stock-api-error';

jest.mock('../../hooks/useKlineSeries');
jest.mock('../../lib/klinecharts', () => ({
  createKLineChart: jest.fn().mockResolvedValue({
    update: jest.fn(),
    destroy: jest.fn()
  })
}));

const mockUseKlineSeries = useKlineSeries as jest.MockedFunction<
  typeof useKlineSeries
>;

describe('KLineChart', () => {
  const buildSeries = (interval: KLineInterval = 'day') => ({
    symbol: 'AAPL',
    range: {
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2024-01-01T00:00:00.000Z',
      interval
    },
    candles: [],
    lastUpdated: '2024-01-01T00:00:00.000Z'
  });

  beforeEach(() => {
    mockUseKlineSeries.mockReset();
  });

  it('renders loading state and chart container', () => {
    mockUseKlineSeries.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    render(<KLineChart ticker='AAPL' />);

    const container = screen.getByLabelText('KLine chart');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'true');
  });

  it('updates ticker label when ticker changes', () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries(),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    const { rerender } = render(<KLineChart ticker='AAPL' />);
    expect(screen.getByText('AAPL K Line Chart')).toBeInTheDocument();

    rerender(<KLineChart ticker='MSFT' />);
    expect(screen.getByText('MSFT K Line Chart')).toBeInTheDocument();
  });

  it('renders no-data state with retry action', () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries(),
      isLoading: false,
      isError: false,
      error: null,
      noData: true,
      refetch: jest.fn()
    } as any);

    render(<KLineChart ticker='AAPL' />);

    expect(
      screen.getByText('No K line data available for AAPL.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the interval selector and active interval metadata', async () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries('month'),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    const onIntervalChange = jest.fn();

    render(
      <KLineChart
        ticker='AAPL'
        interval='month'
        onIntervalChange={onIntervalChange}
      />
    );

    expect(screen.getByText('Monthly candles')).toBeInTheDocument();
    expect(screen.getByText(/1M/)).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Month interval' })
    ).toHaveAttribute('data-state', 'on');

    await userEvent.click(screen.getByRole('radio', { name: 'Week interval' }));

    expect(onIntervalChange).toHaveBeenCalledWith('week');
  });

  it('renders error state and calls retry', async () => {
    const refetch = jest.fn();
    mockUseKlineSeries.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
      noData: false,
      refetch
    } as any);

    render(<KLineChart ticker='AAPL' />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('renders setup-specific state for missing Longbridge credentials without retry', () => {
    mockUseKlineSeries.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new StockApiResponseError(
        'Longbridge credentials not configured',
        401,
        'INVALID_API_KEY'
      ),
      noData: false,
      refetch: jest.fn()
    } as any);

    render(<KLineChart ticker='AAPL' />);

    expect(screen.getByText('Market data setup required.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open operations/i })
    ).toHaveAttribute('href', '/dashboard/operations');
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument();
  });
});
