'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketData {
  indices: MarketIndex[];
  lastUpdated: string;
  isStale?: boolean;
}

// Mock market data
const mockMarketData: MarketData = {
  indices: [
    {
      symbol: 'SPX',
      name: 'S&P 500',
      price: 4185.47,
      change: 12.35,
      changePercent: 0.296
    },
    {
      symbol: 'IXIC',
      name: 'NASDAQ',
      price: 12965.34,
      change: -45.67,
      changePercent: -0.351
    },
    {
      symbol: 'DJI',
      name: 'DOW',
      price: 33875.4,
      change: 89.12,
      changePercent: 0.264
    }
  ],
  lastUpdated: new Date().toISOString()
};

async function fetchMarketData(): Promise<MarketData> {
  // In a real app, this would fetch from /api/dashboard/data
  // For now, return mock data with slight delay to simulate network
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockMarketData;
}

export function MarketOverview() {
  const { data, isLoading, error, isStale } = useQuery({
    queryKey: ['market-overview'],
    queryFn: fetchMarketData,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    onError: (error: any) => {
      toast.error('Failed to load market data', {
        description:
          error?.message || 'Please check your connection and try again.'
      });
    }
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

  if (error) {
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
        {isLoading ? (
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='space-y-2 text-center'>
                <Skeleton className='mx-auto h-8 w-20' />
                <Skeleton className='mx-auto h-4 w-16' />
                <Skeleton className='mx-auto h-3 w-24' />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            {data.indices.map((index) => {
              const isPositive = index.change >= 0;
              return (
                <div key={index.symbol} className='text-center'>
                  <div className='text-2xl font-bold'>
                    {formatPrice(index.price)}
                  </div>
                  <div className='text-muted-foreground text-sm font-medium'>
                    {index.name}
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatChange(index.change, index.changePercent)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className='text-muted-foreground text-center'>
            No market data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
