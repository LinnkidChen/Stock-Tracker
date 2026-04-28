/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KLineChart } from '../KLineChart';
import { useKlineSeries } from '../../hooks/useKlineSeries';
import { createKLineChart } from '../../lib/klinecharts';
import { DEFAULT_CHART_INDICATORS } from '../../lib/chart-workspace';
import type { KLineCandle, KLineInterval } from '@/lib/types/stock-api';

jest.mock('../../hooks/useKlineSeries');
jest.mock('../../lib/klinecharts', () => ({
  createKLineChart: jest.fn()
}));

const mockUseKlineSeries = useKlineSeries as jest.MockedFunction<
  typeof useKlineSeries
>;
const mockCreateKLineChart = createKLineChart as jest.MockedFunction<
  typeof createKLineChart
>;

describe('KLineChart', () => {
  let mockChartHandle: {
    update: jest.Mock;
    destroy: jest.Mock;
  };

  const buildSeries = (
    interval: KLineInterval = 'day',
    candles: KLineCandle[] = []
  ) => ({
    symbol: 'AAPL',
    range: {
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2024-01-01T00:00:00.000Z',
      interval
    },
    candles,
    lastUpdated: '2024-01-01T00:00:00.000Z'
  });

  beforeEach(() => {
    mockUseKlineSeries.mockReset();
    mockChartHandle = {
      update: jest.fn(),
      destroy: jest.fn()
    };
    mockCreateKLineChart.mockReset();
    mockCreateKLineChart.mockResolvedValue(mockChartHandle as any);
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
    expect(
      screen.getByText(/Jan 1, 2023 - Jan 1, 2024 · 1M/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Month interval' })
    ).toHaveAttribute('data-state', 'on');

    await userEvent.click(screen.getByRole('radio', { name: 'Week interval' }));

    expect(onIntervalChange).toHaveBeenCalledWith('week');
  });

  it('renders range and display preference controls', async () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries('day'),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    const onRangeChange = jest.fn();
    const onPreferencesChange = jest.fn();

    render(
      <KLineChart
        ticker='AAPL'
        range='3m'
        onRangeChange={onRangeChange}
        preferences={{
          showVolume: false,
          showGrid: true,
          candleType: 'area',
          indicators: DEFAULT_CHART_INDICATORS
        }}
        onPreferencesChange={onPreferencesChange}
      />
    );

    expect(screen.getByRole('radio', { name: '3M range' })).toHaveAttribute(
      'data-state',
      'on'
    );
    expect(screen.getByRole('switch', { name: 'Volume' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Grid' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Area candle type' })
    ).toHaveAttribute('data-state', 'on');

    await userEvent.click(screen.getByRole('radio', { name: '6M range' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Grid' }));
    await userEvent.click(
      screen.getByRole('radio', { name: 'OHLC candle type' })
    );

    expect(onRangeChange).toHaveBeenCalledWith('6m');
    expect(onPreferencesChange).toHaveBeenCalledWith({ showGrid: false });
    expect(onPreferencesChange).toHaveBeenCalledWith({ candleType: 'ohlc' });
  });

  it('renders indicator toggles with all defaults off and persists changes', async () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries('day'),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    const onPreferencesChange = jest.fn();

    render(
      <KLineChart
        ticker='AAPL'
        onPreferencesChange={onPreferencesChange}
      />
    );

    ['MA', 'EMA', 'VWAP', 'BOLL', 'RSI', 'MACD'].forEach((indicator) => {
      expect(
        screen.getByRole('button', { name: `${indicator} indicator` })
      ).toHaveAttribute('data-state', 'off');
    });

    await userEvent.click(screen.getByRole('button', { name: 'MA indicator' }));
    await userEvent.click(screen.getByRole('button', { name: 'RSI indicator' }));

    expect(onPreferencesChange).toHaveBeenCalledWith({
      indicators: {
        ...DEFAULT_CHART_INDICATORS,
        MA: true
      }
    });
    expect(onPreferencesChange).toHaveBeenCalledWith({
      indicators: {
        ...DEFAULT_CHART_INDICATORS,
        RSI: true
      }
    });
  });

  it('filters candles by range before updating the chart', async () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries('day', [
        {
          timestamp: Date.UTC(2024, 0, 1),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 100
        },
        {
          timestamp: Date.UTC(2024, 2, 20),
          open: 106,
          high: 112,
          low: 101,
          close: 108,
          volume: 150
        },
        {
          timestamp: Date.UTC(2024, 3, 20),
          open: 108,
          high: 116,
          low: 104,
          close: 114,
          volume: 175
        }
      ]),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    render(<KLineChart ticker='AAPL' range='1m' />);

    await waitFor(() => expect(mockChartHandle.update).toHaveBeenCalled());

    const calls = mockChartHandle.update.mock.calls;
    const latestCall = calls[calls.length - 1];

    expect(latestCall[1]).toHaveLength(2);
    expect(latestCall[1].map((candle: { close: number }) => candle.close)).toEqual([
      108, 114
    ]);
  });

  it('passes display preferences to the klinecharts adapter', async () => {
    mockUseKlineSeries.mockReturnValue({
      data: buildSeries('day'),
      isLoading: false,
      isError: false,
      error: null,
      noData: false,
      refetch: jest.fn()
    } as any);

    const preferences = {
      showVolume: false,
      showGrid: false,
      candleType: 'ohlc' as const,
      indicators: {
        ...DEFAULT_CHART_INDICATORS,
        MA: true,
        MACD: true
      }
    };

    render(<KLineChart ticker='AAPL' preferences={preferences} />);

    await waitFor(() => expect(mockCreateKLineChart).toHaveBeenCalled());

    expect(mockCreateKLineChart).toHaveBeenCalledWith(expect.any(HTMLElement), {
      symbol: 'AAPL',
      interval: 'day',
      data: [],
      preferences
    });
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
});
