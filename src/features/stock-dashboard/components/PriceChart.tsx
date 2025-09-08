'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreatePriceChartOptions,
  PriceChartHandle
} from '@/features/stock-dashboard/lib/lightweight-charts';
import type { Time } from 'lightweight-charts';
import { createPriceChart } from '@/features/stock-dashboard/lib/lightweight-charts';

interface PriceChartProps {
  ticker: string;
}

function useThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function generateMockData(symbol: string, points = 120) {
  // Deterministic-ish seed by symbol
  let seed =
    Array.from(symbol).reduce((acc, c) => acc + c.charCodeAt(0), 0) || 1;
  const rand = () => (Math.sin(seed++) + 1) / 2;

  const now = new Date();
  const bars: {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];

  // More realistic starting price based on symbol
  const basePrice =
    symbol === 'AAPL'
      ? 180
      : symbol === 'GOOGL'
        ? 140
        : symbol === 'MSFT'
          ? 380
          : symbol === 'TSLA'
            ? 250
            : 100;

  let price = basePrice + (rand() - 0.5) * 20;

  for (let i = points - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const vol = 10000000 + Math.floor(rand() * 5000000);
    const o = price;

    // More realistic price movement
    const volatility = 0.02; // 2% daily volatility
    const trend = 0.0005; // slight upward trend
    const change = (rand() - 0.5 + trend) * basePrice * volatility;

    const c = Math.max(1, o + change);
    const h = Math.max(o, c) + Math.abs(change) * rand() * 0.5;
    const l = Math.min(o, c) - Math.abs(change) * rand() * 0.5;
    price = c;

    bars.push({
      time: Math.floor(day.getTime() / 1000) as Time,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: vol
    });
  }

  return { bars };
}

export function PriceChart({ ticker }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<PriceChartHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useThemeMode();

  const initial = useMemo(() => generateMockData(ticker), [ticker]);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;

    const options: CreatePriceChartOptions = {
      height: 400,
      theme,
      initialData: initial.bars
    };

    setLoading(true);
    setError(null);
    createPriceChart(containerRef.current, options)
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        chartRef.current = handle;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to initialize chart');
          setLoading(false);
          toast.error('Chart initialization failed', {
            description: 'Unable to load chart library. Please try again.'
          });
        }
      });

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // We only want to initialize once on mount; updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const data = generateMockData(ticker);
    chartRef.current.update(data.bars);
  }, [ticker]);

  const handleRetry = () => {
    if (!containerRef.current) return;

    const options: CreatePriceChartOptions = {
      height: 400,
      theme,
      initialData: initial.bars
    };

    setLoading(true);
    setError(null);
    createPriceChart(containerRef.current, options)
      .then((handle) => {
        chartRef.current = handle;
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to initialize chart');
        setLoading(false);
      });
  };

  // Calculate price change stats
  const priceStats = useMemo(() => {
    if (initial.bars.length < 2) return null;
    const latest = initial.bars[initial.bars.length - 1];
    const previous = initial.bars[initial.bars.length - 2];
    const change = latest.close - previous.close;
    const changePercent = (change / previous.close) * 100;
    const dayHigh = latest.high;
    const dayLow = latest.low;
    return {
      price: latest.close,
      change,
      changePercent,
      dayHigh,
      dayLow,
      isUp: change >= 0
    };
  }, [initial.bars]);

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <CardTitle className='text-xl font-semibold'>
              {ticker} Price Chart
            </CardTitle>
            {priceStats && !loading && (
              <div className='flex items-center gap-3'>
                <span className='text-2xl font-bold'>
                  ${priceStats.price.toFixed(2)}
                </span>
                <Badge
                  variant={priceStats.isUp ? 'default' : 'destructive'}
                  className='flex items-center gap-1'
                >
                  {priceStats.isUp ? (
                    <TrendingUp className='h-3 w-3' />
                  ) : (
                    <TrendingDown className='h-3 w-3' />
                  )}
                  {priceStats.isUp ? '+' : ''}
                  {priceStats.change.toFixed(2)}({priceStats.isUp ? '+' : ''}
                  {priceStats.changePercent.toFixed(2)}%)
                </Badge>
              </div>
            )}
          </div>
        </div>
        {priceStats && !loading && (
          <div className='text-muted-foreground mt-3 flex gap-4 text-xs'>
            <div>
              <span className='font-medium'>Day High:</span> $
              {priceStats.dayHigh.toFixed(2)}
            </div>
            <div>
              <span className='font-medium'>Day Low:</span> $
              {priceStats.dayLow.toFixed(2)}
            </div>
            <div>
              <span className='font-medium'>Range:</span> $
              {(priceStats.dayHigh - priceStats.dayLow).toFixed(2)}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className='p-0'>
        {error ? (
          <div className='flex h-96 flex-col items-center justify-center gap-3'>
            <div className='text-sm text-red-600'>{error}</div>
            <Button onClick={handleRetry} size='sm'>
              Retry
            </Button>
          </div>
        ) : (
          <div className='bg-background relative h-96 w-full'>
            <div
              ref={containerRef}
              aria-busy={loading}
              className='absolute inset-0'
            />
            {loading && <Skeleton className='absolute inset-0' />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
