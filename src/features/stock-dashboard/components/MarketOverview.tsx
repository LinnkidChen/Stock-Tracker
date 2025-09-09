'use client';

import { useQueries } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Market indices configuration
const MARKET_INDICES = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ' },
  { symbol: 'DIA', name: 'DOW' }
] as const;

export function MarketOverview() {
  const queries = useQueries({
    queries: MARKET_INDICES.map(({ symbol }) => ({
      queryKey: ['stock-quote', symbol],
      queryFn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const res = await fetch(`/api/stocks/quote/${symbol}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) throw new Error(`Failed to fetch ${symbol}`);
          const data = await res.json();
          if (!data.success || !data.data)
            throw new Error(data.error?.message || 'Failed to fetch data');
          return data.data;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      staleTime: 5 * 60 * 1000, // 5 minutes to respect rate limits
      refetchInterval: false as const, // Disabled auto-refresh
      retry: 3
    }))
  });

  const hasError = queries.some((query) => query.error);
  const isStale = queries.some((query) => query.isStale);

  const marketData = queries.map((query, index) => {
    const { symbol, name } = MARKET_INDICES[index];
    return {
      symbol,
      name,
      data: query.data,
      isLoading: query.isLoading,
      error: query.error
    };
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : '';
    const percentSign = changePercent >= 0 ? '+' : '';
    return `${sign}${formatPrice(change)} (${percentSign}${changePercent.toFixed(2)}%)`;
  };

  if (hasError && !marketData.some((item) => item.data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-sm text-red-600'>
            Failed to load market data. Using cached data if available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          Market Overview
          {isStale && (
            <div className='rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-600'>
              Stale Data
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          {marketData.map((item) => {
            if (item.isLoading || !item.data) {
              return (
                <div key={item.symbol} className='space-y-2 text-center'>
                  <Skeleton className='mx-auto h-8 w-20' />
                  <Skeleton className='mx-auto h-4 w-16' />
                  <Skeleton className='mx-auto h-3 w-24' />
                </div>
              );
            }

            const isPositive = item.data.change >= 0;
            return (
              <div key={item.symbol} className='text-center'>
                <div className='text-2xl font-bold'>
                  {formatPrice(item.data.price)}
                </div>
                <div className='text-muted-foreground text-sm font-medium'>
                  {item.name}
                </div>
                <div
                  className={`text-xs font-medium ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatChange(item.data.change, item.data.changePercent)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
