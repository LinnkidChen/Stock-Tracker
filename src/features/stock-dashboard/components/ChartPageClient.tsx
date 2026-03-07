'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuoteProviderToggle } from './QuoteProviderToggle';
import { useDashboardStore } from '../store';
import { KLineChart } from './KLineChart';
import { TickerInput } from './TickerInput';
import { Card, CardContent } from '@/components/ui/card';

export function ChartPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedTicker, setSelectedTicker, quoteProvider } =
    useDashboardStore();

  const symbol = searchParams.get('symbol');

  // Sync URL symbol to store
  useEffect(() => {
    if (symbol && symbol !== selectedTicker) {
      setSelectedTicker(symbol);
    } else if (!symbol && selectedTicker) {
      // If no symbol in URL but there is one in store, update URL
      router.replace(`/dashboard/charts?symbol=${selectedTicker}`);
    }
  }, [symbol, selectedTicker, setSelectedTicker, router]);

  const activeTicker = symbol || selectedTicker;
  const handleTickerSubmit = (ticker: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('symbol', ticker);
    router.replace(`/dashboard/charts?${nextSearchParams.toString()}`);
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
