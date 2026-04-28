'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WatchlistItem } from '@/types/watchlist';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { LoadingSkeleton } from './LoadingSkeleton';

interface WatchlistData {
  watchlist: string[];
  items: WatchlistItem[];
}

const EMPTY_WATCHLIST_ITEMS: WatchlistItem[] = [];

type ApiError = Error & { status?: number };

async function fetchWatchlist(): Promise<WatchlistData> {
  const response = await fetch('/api/watchlist');
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const error = new Error(
      payload?.error?.message || 'Failed to load watchlist'
    ) as ApiError;
    error.status = response.status;
    throw error;
  }

  return payload.data as WatchlistData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function WatchlistSummaryCard() {
  const query = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist
  });
  const items = query.data?.items ?? EMPTY_WATCHLIST_ITEMS;
  const symbols = useMemo(() => items.map((item) => item.symbol), [items]);
  const { pricesMap, isLoading } = useWatchlistPrices(symbols);

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Watchlist</CardTitle>
        <Button asChild size='sm' variant='outline'>
          <Link href='/dashboard/watchlist'>
            Open
            <ArrowRightIcon className='size-4' />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        {query.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : query.isError ? (
          <div className='text-destructive text-sm'>
            Failed to load watchlist
          </div>
        ) : items.length === 0 ? (
          <div className='text-muted-foreground text-sm'>
            No watchlist symbols yet. Open Watchlist to add one.
          </div>
        ) : (
          <>
            <div className='text-muted-foreground text-sm'>
              Tracking {items.length} symbol{items.length === 1 ? '' : 's'}
            </div>
            <div className='space-y-3'>
              {items.slice(0, 5).map((item) => {
                const price = pricesMap[item.symbol];

                return (
                  <div
                    key={item.id}
                    className='flex items-center justify-between gap-3 text-sm'
                  >
                    <div className='min-w-0'>
                      <div className='font-medium'>{item.symbol}</div>
                      <div className='text-muted-foreground truncate text-xs'>
                        {item.exchange || 'Ungrouped'}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='font-medium'>
                        {price
                          ? formatCurrency(price.price)
                          : isLoading
                            ? 'Loading'
                            : '-'}
                      </div>
                      {price ? (
                        <div
                          className={`text-xs ${
                            price.change >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatPercent(price.changePercent)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
