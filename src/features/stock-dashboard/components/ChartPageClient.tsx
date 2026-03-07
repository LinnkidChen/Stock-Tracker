'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuoteProviderToggle } from './QuoteProviderToggle';
import { useDashboardStore } from '../store';
import { KLineChart } from './KLineChart';
import { TickerInput } from './TickerInput';
import { Card, CardContent } from '@/components/ui/card';
import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineInterval
} from '@/lib/types/stock-api';

function buildChartsHref(
  searchParams: URLSearchParams,
  symbol?: string | null,
  interval?: KLineInterval
) {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  if (symbol) {
    nextSearchParams.set('symbol', symbol);
  } else {
    nextSearchParams.delete('symbol');
  }

  if (interval) {
    nextSearchParams.set('interval', interval);
  } else {
    nextSearchParams.delete('interval');
  }

  const query = nextSearchParams.toString();
  return query ? `/dashboard/charts?${query}` : '/dashboard/charts';
}

export function ChartPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedTicker, setSelectedTicker, quoteProvider } =
    useDashboardStore();

  const symbol = searchParams.get('symbol');
  const rawInterval = searchParams.get('interval')?.toLowerCase();
  const interval = isKLineInterval(rawInterval)
    ? rawInterval
    : DEFAULT_KLINE_INTERVAL;

  // Sync URL symbol to store
  useEffect(() => {
    if (symbol && symbol !== selectedTicker) {
      setSelectedTicker(symbol);
    } else if (!symbol && selectedTicker) {
      router.replace(
        buildChartsHref(
          new URLSearchParams(searchParams.toString()),
          selectedTicker,
          interval
        )
      );
    }
  }, [
    interval,
    router,
    searchParams,
    selectedTicker,
    setSelectedTicker,
    symbol
  ]);

  const activeTicker = symbol || selectedTicker;
  const handleTickerSubmit = (ticker: string) => {
    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        ticker,
        interval
      )
    );
  };

  const handleIntervalChange = (nextInterval: KLineInterval) => {
    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        activeTicker,
        nextInterval
      )
    );
  };

  return (
    <div className='flex h-full flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Technical Analysis</h1>
        <div className='flex items-center gap-4'>
          <QuoteProviderToggle />
          <div className='w-[300px]'>
            <TickerInput onTickerSubmit={handleTickerSubmit} />
          </div>
        </div>
      </div>

      <div className='flex-1'>
        {activeTicker ? (
          <KLineChart
            ticker={activeTicker}
            provider={quoteProvider}
            interval={interval}
            onIntervalChange={handleIntervalChange}
            className='h-full'
          />
        ) : (
          <Card className='flex h-[400px] items-center justify-center'>
            <CardContent className='pt-6 text-center'>
              <p className='text-muted-foreground'>
                Please select a stock ticker to view the chart.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
