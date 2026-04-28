'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuoteProviderToggle } from './QuoteProviderToggle';
import { useDashboardStore } from '../store';
import { KLineChart } from './KLineChart';
import { TickerInput } from './TickerInput';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineInterval
} from '@/lib/types/stock-api';

const SUGGESTED_CHART_SYMBOLS = ['AAPL', 'MSFT', 'NVDA'] as const;

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
  const intervalRef = useRef(interval);

  intervalRef.current = interval;

  useEffect(() => {
    if (!symbol || symbol === selectedTicker) {
      return;
    }

    setSelectedTicker(symbol);
  }, [selectedTicker, setSelectedTicker, symbol]);

  useEffect(() => {
    if (symbol || !selectedTicker) {
      return;
    }

    router.replace(
      buildChartsHref(
        new URLSearchParams(),
        selectedTicker,
        intervalRef.current
      )
    );
  }, [router, selectedTicker, symbol]);

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
          <Card className='flex min-h-[400px] items-center justify-center'>
            <CardContent className='space-y-5 pt-6 text-center'>
              <div className='space-y-2'>
                <h2 className='text-xl font-semibold'>Choose a ticker</h2>
                <p className='text-muted-foreground max-w-md text-sm'>
                  Search for a symbol or start with a commonly watched ticker to
                  open the technical analysis chart.
                </p>
              </div>
              <div className='flex flex-wrap justify-center gap-2'>
                {SUGGESTED_CHART_SYMBOLS.map((suggestedSymbol) => (
                  <Button
                    key={suggestedSymbol}
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleTickerSubmit(suggestedSymbol)}
                  >
                    {suggestedSymbol}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
