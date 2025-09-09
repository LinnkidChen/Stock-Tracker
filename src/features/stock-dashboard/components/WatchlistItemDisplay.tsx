'use client';

import { Button } from '@/components/ui/button';
import { PriceIndicator } from './PriceIndicator';
import { WatchlistItemWithPrice } from '@/types/stocks';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WatchlistItemDisplayProps {
  item: WatchlistItemWithPrice;
  onRemove: (symbol: string) => void;
  isLoading?: boolean;
  isRemoving?: boolean;
  error?: string | null;
  className?: string;
}

export function WatchlistItemDisplay({
  item,
  onRemove,
  isLoading = false,
  isRemoving = false,
  error,
  className
}: WatchlistItemDisplayProps) {
  const hasPrice =
    item.currentPrice !== undefined &&
    item.change !== undefined &&
    item.changePercent !== undefined;

  const handleRemove = () => {
    onRemove(item.symbol);
  };

  return (
    <div
      className={cn(
        'bg-card flex items-center justify-between rounded-lg border p-3',
        className
      )}
    >
      <div className='flex items-center space-x-3'>
        <div className='text-base font-medium'>{item.symbol}</div>

        {isLoading ? (
          <div className='text-muted-foreground flex items-center space-x-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span className='text-sm'>Loading...</span>
          </div>
        ) : error ? (
          <div className='text-destructive flex items-center space-x-2'>
            <AlertCircle className='h-4 w-4' />
            <span className='text-sm'>{error}</span>
          </div>
        ) : hasPrice ? (
          <PriceIndicator
            price={item.currentPrice!}
            change={item.change!}
            changePercent={item.changePercent!}
            showArrow={true}
            showPercent={true}
            className='flex-1'
          />
        ) : (
          <div className='text-muted-foreground text-sm'>No price data</div>
        )}
      </div>

      <Button
        variant='outline'
        size='sm'
        disabled={isRemoving}
        onClick={handleRemove}
        className='ml-4'
      >
        {isRemoving ? (
          <>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            Removing
          </>
        ) : (
          'Remove'
        )}
      </Button>
    </div>
  );
}
