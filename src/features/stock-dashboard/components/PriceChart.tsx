'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type {
  CreatePriceChartOptions,
  PriceChartHandle
} from '@/features/stock-dashboard/lib/lightweight-charts';
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
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];
  let price = 100 + rand() * 50;
  for (let i = points - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const vol = 1000000 + Math.floor(rand() * 500000);
    const o = price;
    const change = (rand() - 0.5) * 2; // -1..1
    const c = Math.max(1, o + change * 2);
    const h = Math.max(o, c) + rand() * 2;
    const l = Math.min(o, c) - rand() * 2;
    price = c;
    bars.push({
      time: Math.floor(day.getTime() / 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: vol
    });
  }
  const volumes = bars.map((b) => ({
    time: b.time,
    value: b.volume,
    color: b.close >= b.open ? '#16a34a' : '#ef4444'
  }));
  return { bars, volumes };
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
      height: 320,
      theme,
      initialData: initial.bars,
      volumeData: initial.volumes
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
      .catch((err) => {
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
    chartRef.current.update(data.bars, data.volumes);
  }, [ticker]);

  const handleRetry = () => {
    if (!containerRef.current) return;

    const options: CreatePriceChartOptions = {
      height: 320,
      theme,
      initialData: initial.bars,
      volumeData: initial.volumes
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ticker} Price Chart</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className='flex h-64 flex-col items-center justify-center gap-3'>
            <div className='text-sm text-red-600'>{error}</div>
            <Button onClick={handleRetry} size='sm'>
              Retry
            </Button>
          </div>
        ) : (
          <div className='relative h-64 w-full'>
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
