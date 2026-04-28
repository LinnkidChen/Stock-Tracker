'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { KLineData } from 'klinecharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import { validateTicker } from '@/lib/validation/ticker';
import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineCandle,
  type KLineInterval,
  type TimeRange
} from '@/lib/types/stock-api';
import { useKlineSeries } from '../hooks/useKlineSeries';
import { createKLineChart, type KLineChartHandle } from '../lib/klinecharts';
import {
  DEFAULT_CHART_WORKSPACE,
  filterCandlesByRange,
  isChartCandleType,
  isChartRange,
  type ChartCandleType,
  type ChartPreferences,
  type ChartRange
} from '../lib/chart-workspace';

interface KLineChartProps {
  ticker: string;
  className?: string;
  provider?: string;
  interval?: KLineInterval;
  onIntervalChange?: (interval: KLineInterval) => void;
  range?: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
  preferences?: ChartPreferences;
  onPreferencesChange?: (preferences: Partial<ChartPreferences>) => void;
}

const KLINE_INTERVAL_META: Record<
  KLineInterval,
  {
    badge: string;
    label: string;
    subtitle: string;
  }
> = {
  day: { label: 'Day', badge: '1D', subtitle: 'Daily candles' },
  week: { label: 'Week', badge: '1W', subtitle: 'Weekly candles' },
  month: { label: 'Month', badge: '1M', subtitle: 'Monthly candles' },
  year: { label: 'Year', badge: '1Y', subtitle: 'Yearly candles' }
};

const KLINE_INTERVAL_OPTIONS: Array<{
  label: string;
  value: KLineInterval;
}> = (['day', 'week', 'month', 'year'] as const).map((value) => ({
  value,
  label: KLINE_INTERVAL_META[value].label
}));

const CHART_RANGE_OPTIONS: Array<{
  label: string;
  value: ChartRange;
}> = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: 'Max', value: 'max' }
];

const CANDLE_TYPE_OPTIONS: Array<{
  label: string;
  value: ChartCandleType;
}> = [
  { label: 'Candle', value: 'candle_solid' },
  { label: 'OHLC', value: 'ohlc' },
  { label: 'Area', value: 'area' }
];

function getIntervalMeta(interval: KLineInterval) {
  return KLINE_INTERVAL_META[interval];
}

function formatRangeLabel(range: TimeRange) {
  const start = new Date(range.startDate).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const end = new Date(range.endDate).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${start} - ${end} · ${getIntervalMeta(range.interval).badge}`;
}

function formatCandleRangeLabel(
  candles: KLineCandle[],
  interval: KLineInterval
) {
  if (candles.length === 0) {
    return getIntervalMeta(interval).badge;
  }

  return formatRangeLabel({
    startDate: new Date(candles[0].timestamp).toISOString(),
    endDate: new Date(candles[candles.length - 1].timestamp).toISOString(),
    interval
  });
}

export function KLineChart({
  ticker,
  className,
  provider = CANONICAL_QUOTE_PROVIDER,
  interval = DEFAULT_KLINE_INTERVAL,
  onIntervalChange,
  range = DEFAULT_CHART_WORKSPACE.range,
  onRangeChange,
  preferences = DEFAULT_CHART_WORKSPACE.preferences,
  onPreferencesChange
}: KLineChartProps) {
  const validation = useMemo(() => validateTicker(ticker), [ticker]);
  const querySymbol = validation.isValid ? ticker : undefined;
  const { data, isLoading, isError, error, noData, refetch } = useKlineSeries(
    querySymbol,
    interval,
    provider
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<KLineChartHandle | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const intervalRef = useRef(interval);
  const preferencesRef = useRef(preferences);

  intervalRef.current = interval;
  preferencesRef.current = preferences;

  const activePreferences = useMemo(
    () => ({
      showVolume: preferences.showVolume,
      showGrid: preferences.showGrid,
      candleType: preferences.candleType
    }),
    [preferences.candleType, preferences.showGrid, preferences.showVolume]
  );

  const filteredCandles = useMemo(
    () => (data?.candles ? filterCandlesByRange(data.candles, range) : []),
    [data?.candles, range]
  );

  // Fix: Safe type mapping instead of assertion
  const chartData = useMemo(
    () =>
      filteredCandles.map(
        (candle) =>
          ({
            timestamp: candle.timestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            turnover: 0 // KLineData requires turnover, setting default or if available
          }) as KLineData
      ),
    [filteredCandles]
  );

  const selectedInterval = data?.range.interval ?? interval;
  const rangeLabel = useMemo(
    () =>
      filteredCandles.length > 0
        ? formatCandleRangeLabel(filteredCandles, selectedInterval)
        : data?.range
          ? formatRangeLabel(data.range)
          : getIntervalMeta(interval).badge,
    [data?.range, filteredCandles, interval, selectedInterval]
  );
  const intervalMeta = getIntervalMeta(selectedInterval);

  useEffect(() => {
    if (!containerRef.current) return;

    let currentChart: KLineChartHandle | null = null;
    let cancelled = false;

    // Cleanup previous chart if it exists (though effect cleanup handles this usually, proper flow ensures it)
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    setChartReady(false);
    setChartError(null);

    createKLineChart(containerRef.current, {
      symbol: ticker,
      interval: intervalRef.current,
      data: [],
      preferences: preferencesRef.current
    })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        currentChart = handle;
        chartRef.current = handle;
        setChartReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          Sentry.captureException(err);
          setChartError('Failed to initialize chart');
          setChartReady(false);
        }
      });

    return () => {
      cancelled = true;
      // Destroy the chart created in this effect
      currentChart?.destroy();
      // Ensure ref is cleaned if it matches
      if (chartRef.current === currentChart) {
        chartRef.current = null;
      }
    };
  }, [ticker, retryTrigger]);

  useEffect(() => {
    if (!chartRef.current || !querySymbol) return;
    chartRef.current.update(querySymbol, chartData, interval, activePreferences);
  }, [activePreferences, chartData, chartReady, interval, querySymbol]);

  const handleRetry = () => {
    if (chartError) {
      setRetryTrigger((prev) => prev + 1);
    }
    refetch();
  };

  const busy = isLoading || !chartReady;
  const hasInvalidTicker = !validation.isValid;
  const showNoData = noData && !isError && !chartError;

  let overlay: {
    title: string;
    description?: string;
    showRetry?: boolean;
    tone?: 'error' | 'muted';
  } | null = null;

  if (hasInvalidTicker) {
    overlay = {
      title: 'Enter a valid ticker to view the K line chart.',
      description: validation.error,
      tone: 'muted'
    };
  } else if (chartError || isError) {
    overlay = {
      title:
        error instanceof Error
          ? error.message
          : chartError || 'Failed to load kline data',
      description: 'Please try again in a moment.',
      showRetry: true,
      tone: 'error'
    };
  } else if (showNoData) {
    overlay = {
      title: `No K line data available for ${ticker}.`,
      description: 'Try another ticker or retry later.',
      showRetry: true,
      tone: 'muted'
    };
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className='space-y-3 pb-3'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div className='space-y-1'>
            <CardTitle className='text-xl font-semibold'>
              {ticker} K Line Chart
            </CardTitle>
            <div className='text-muted-foreground text-xs'>
              {intervalMeta.subtitle}
            </div>
          </div>
          <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end'>
            <Badge variant='outline'>{rangeLabel}</Badge>
            <div className='flex flex-wrap items-center justify-start gap-2 lg:justify-end'>
              <ToggleGroup
                type='single'
                value={interval}
                variant='outline'
                size='sm'
                aria-label='K line interval'
                className='w-full flex-wrap sm:w-auto'
                onValueChange={(value) => {
                  if (isKLineInterval(value) && value !== interval) {
                    onIntervalChange?.(value);
                  }
                }}
              >
                {KLINE_INTERVAL_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={`${option.label} interval`}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup
                type='single'
                value={range}
                variant='outline'
                size='sm'
                aria-label='Chart range'
                className='w-full flex-wrap sm:w-auto'
                onValueChange={(value) => {
                  if (isChartRange(value) && value !== range) {
                    onRangeChange?.(value);
                  }
                }}
              >
                {CHART_RANGE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={`${option.label} range`}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className='flex flex-wrap items-center justify-start gap-3 lg:justify-end'>
              <div className='flex items-center gap-2'>
                <Switch
                  id='chart-volume'
                  checked={preferences.showVolume}
                  onCheckedChange={(showVolume) =>
                    onPreferencesChange?.({ showVolume })
                  }
                />
                <Label htmlFor='chart-volume' className='text-xs'>
                  Volume
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch
                  id='chart-grid'
                  checked={preferences.showGrid}
                  onCheckedChange={(showGrid) =>
                    onPreferencesChange?.({ showGrid })
                  }
                />
                <Label htmlFor='chart-grid' className='text-xs'>
                  Grid
                </Label>
              </div>
              <ToggleGroup
                type='single'
                value={preferences.candleType}
                variant='outline'
                size='sm'
                aria-label='Candle type'
                className='w-full flex-wrap sm:w-auto'
                onValueChange={(value) => {
                  if (
                    isChartCandleType(value) &&
                    value !== preferences.candleType
                  ) {
                    onPreferencesChange?.({ candleType: value });
                  }
                }}
              >
                {CANDLE_TYPE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={`${option.label} candle type`}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='bg-background relative h-[500px] min-h-[400px] w-full lg:h-[600px]'>
          <div
            ref={containerRef}
            aria-busy={busy}
            aria-label='KLine chart'
            className='absolute inset-0'
            style={{ width: '100%', height: '100%' }}
          />
          {busy && <Skeleton className='absolute inset-0' />}
          {overlay && (
            <div className='bg-background/90 absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center'>
              <div
                className={
                  overlay.tone === 'error'
                    ? 'text-sm text-red-600'
                    : 'text-muted-foreground text-sm'
                }
              >
                {overlay.title}
              </div>
              {overlay.description && (
                <div className='text-muted-foreground text-xs'>
                  {overlay.description}
                </div>
              )}
              {overlay.showRetry && (
                <Button onClick={handleRetry} size='sm'>
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
