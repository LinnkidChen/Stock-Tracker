'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { PriceIndicator } from './PriceIndicator';
import { WatchlistItemWithPrice } from '@/types/stocks';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WatchlistItemDisplayProps {
  item: WatchlistItemWithPrice;
  onRemove: (symbol: string) => void;
  onEdit?: (item: WatchlistItemWithPrice) => void;
  onMoveUp?: (symbol: string) => void;
  onMoveDown?: (symbol: string) => void;
  onClick?: (symbol: string) => void;
  isLoading?: boolean;
  isRemoving?: boolean;
  isReordering?: boolean;
  isStale?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  error?: string | null;
  className?: string;
}

export function WatchlistItemDisplay({
  item,
  onRemove,
  onEdit,
  onMoveUp,
  onMoveDown,
  onClick,
  isLoading = false,
  isRemoving = false,
  isReordering = false,
  isStale = false,
  canMoveUp = false,
  canMoveDown = false,
  error,
  className
}: WatchlistItemDisplayProps) {
  const hasPrice =
    item.currentPrice !== undefined &&
    item.change !== undefined &&
    item.changePercent !== undefined;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.symbol);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(item);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveUp?.(item.symbol);
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveDown?.(item.symbol);
  };

  return (
    <div
      onClick={() => onClick?.(item.symbol)}
      className={cn(
        'bg-card flex items-start justify-between gap-3 rounded-lg border p-3',
        onClick && 'hover:bg-accent/50 cursor-pointer transition-colors',
        className
      )}
    >
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <div className='text-base font-medium'>{item.symbol}</div>
          {item.exchange ? <Badge variant='outline'>{item.exchange}</Badge> : null}
          {isStale ? <Badge variant='secondary'>Stale</Badge> : null}
          {item.note ? (
            <div className='text-muted-foreground max-w-full truncate text-xs'>
              {item.note}
            </div>
          ) : null}
        </div>

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

      <div className='flex shrink-0 items-center gap-1'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={!canMoveUp || isReordering}
              onClick={handleMoveUp}
              aria-label={`Move ${item.symbol} up`}
              className='size-8'
            >
              <ArrowUp className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move up</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={!canMoveDown || isReordering}
              onClick={handleMoveDown}
              aria-label={`Move ${item.symbol} down`}
              className='size-8'
            >
              <ArrowDown className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move down</TooltipContent>
        </Tooltip>
        {onEdit ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={handleEdit}
                aria-label={`Edit ${item.symbol}`}
                className='size-8'
              >
                <Pencil className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit metadata</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={isRemoving}
              onClick={handleRemove}
              aria-label={`Remove ${item.symbol}`}
              className='size-8'
            >
              {isRemoving ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Trash2 className='h-4 w-4' />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
