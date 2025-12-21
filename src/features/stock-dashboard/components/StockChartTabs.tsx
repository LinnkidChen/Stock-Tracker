'use client';

import * as Sentry from '@sentry/nextjs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriceChart } from './PriceChart';
import { KLineChart } from './KLineChart';

interface StockChartTabsProps {
  ticker: string;
}

export function StockChartTabs({ ticker }: StockChartTabsProps) {
  const handleValueChange = (value: string) => {
    if (value === 'kline') {
      Sentry.startSpan({ op: 'ui.click', name: 'KLine Tab Click' }, (span) => {
        span.setAttribute('tab', value);
        span.setAttribute('ticker', ticker);
      });
    }
  };

  return (
    <Tabs defaultValue='price' onValueChange={handleValueChange}>
      <TabsList className='mb-3'>
        <TabsTrigger value='price'>Price</TabsTrigger>
        <TabsTrigger value='kline'>K Line</TabsTrigger>
      </TabsList>
      <TabsContent value='price'>
        <PriceChart ticker={ticker} />
      </TabsContent>
      <TabsContent value='kline'>
        <KLineChart ticker={ticker} />
      </TabsContent>
    </Tabs>
  );
}
