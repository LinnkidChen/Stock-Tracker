'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KLineData } from 'klinecharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { validateTicker } from '@/lib/validation/ticker';
import type { TimeRange } from '@/lib/types/stock-api';
import { useKlineSeries } from '../hooks/useKlineSeries';
import { createKLineChart, type KLineChartHandle } from '../lib/klinecharts';

interface KLineChartProps {
  ticker: string;
}

function formatRangeLabel(range?: TimeRange) {
  if (!range) return '1Y · Daily';
  const start = new Date(range.startDate).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric'
  });
  const end = new Date(range.endDate).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric'
  });
  return `${start} - ${end} · 1D`;
}

export function KLineChart({ ticker }: KLineChartProps) {
  const validation = useMemo(() => validateTicker(ticker), [ticker]);
  const querySymbol = validation.isValid ? ticker : undefined;
  const { data, isLoading, isError, error, noData, refetch } =
    useKlineSeries(querySymbol);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<KLineChartHandle | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const chartData = useMemo(() => (data?.candles ?? []) as KLineData[], [data]);

  const rangeLabel = useMemo(
    () => formatRangeLabel(data?.range),
    [data?.range]
  );

  const initChart = useCallback(() => {
    if (!containerRef.current) return () => {};

    let cancelled = false;
    chartRef.current?.destroy();
    chartRef.current = null;
    setChartReady(false);
    setChartError(null);

    createKLineChart(containerRef.current, {
      symbol: ticker,
      data: []
    })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        chartRef.current = handle;
        setChartReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setChartError('Failed to initialize chart');
          setChartReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    const cancelInit = initChart();
    return () => {
      cancelInit();
      chartRef.current?.destroy();
      chartRef.current = null;
      setChartReady(false);
    };
  }, [initChart]);

  useEffect(() => {
    if (!chartRef.current || !querySymbol) return;
    chartRef.current.update(querySymbol, chartData);
  }, [chartData, querySymbol]);

  const handleRetry = () => {
    if (chartError) {
      initChart();
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
    <Card className='overflow-hidden'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1'>
            <CardTitle className='text-xl font-semibold'>
              {ticker} K Line Chart
            </CardTitle>
            <div className='text-muted-foreground text-xs'>
              1-year daily candles
            </div>
          </div>
          <Badge variant='outline'>{rangeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='bg-background relative h-96 w-full'>
          <div
            ref={containerRef}
            aria-busy={busy}
            aria-label='KLine chart'
            className='absolute inset-0'
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
