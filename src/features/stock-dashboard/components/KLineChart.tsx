'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { KLineData } from 'klinecharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Link from 'next/link';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import { validateTicker } from '@/lib/validation/ticker';
import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineInterval,
  type TimeRange
} from '@/lib/types/stock-api';
import { useKlineSeries } from '../hooks/useKlineSeries';
import { createKLineChart, type KLineChartHandle } from '../lib/klinecharts';
import { isLongbridgeCredentialError } from '../lib/stock-api-error';

interface KLineChartProps {
  ticker: string;
  className?: string;
  provider?: string;
  interval?: KLineInterval;
  onIntervalChange?: (interval: KLineInterval) => void;
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

export function KLineChart({
  ticker,
  className,
  provider = CANONICAL_QUOTE_PROVIDER,
  interval = DEFAULT_KLINE_INTERVAL,
  onIntervalChange
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

  // Fix: Safe type mapping instead of assertion
  const chartData = useMemo(
    () =>
      data?.candles.map(
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
      ) ?? [],
    [data]
  );

  const rangeLabel = useMemo(
    () =>
      data?.range
        ? formatRangeLabel(data.range)
        : getIntervalMeta(interval).badge,
    [data?.range, interval]
  );
  const selectedInterval = data?.range.interval ?? interval;
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
      interval,
      data: []
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
          console.error('Chart initialization failed:', err);
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
    chartRef.current.update(querySymbol, chartData, interval);
  }, [chartData, chartReady, interval, querySymbol]);

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
    actionHref?: string;
    actionLabel?: string;
    tone?: 'error' | 'muted';
  } | null = null;

  if (hasInvalidTicker) {
    overlay = {
      title: 'Enter a valid ticker to view the K line chart.',
      description: validation.error,
      tone: 'muted'
    };
  } else if (isLongbridgeCredentialError(error)) {
    overlay = {
      title: 'Market data setup required.',
      description:
        'Configure Longbridge credentials before loading K line charts.',
      actionHref: '/dashboard/operations',
      actionLabel: 'Open Operations',
      tone: 'error'
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
              {overlay.actionHref && overlay.actionLabel && (
                <Button asChild size='sm' variant='outline'>
                  <Link href={overlay.actionHref}>{overlay.actionLabel}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
