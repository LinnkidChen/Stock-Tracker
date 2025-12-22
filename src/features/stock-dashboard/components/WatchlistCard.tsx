'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import * as Sentry from '@sentry/nextjs';
import { AddTickerError, getAddTickerError } from '../lib/add-ticker-error';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { WatchlistItemDisplay } from './WatchlistItemDisplay';
import { LoadingSkeleton } from './LoadingSkeleton';
import { WatchlistItemWithPrice } from '@/types/stocks';
import { TickerErrorModal } from './TickerErrorModal';
import { useDashboardStore } from '../store';

type SpanLike = {
  setAttribute?: (key: string, value: string | number) => void;
};

async function runWithSpan<T>(
  context: Parameters<typeof Sentry.startSpan>[0],
  fn: (span?: SpanLike) => Promise<T>
): Promise<T> {
  if (typeof Sentry.startSpan !== 'function') {
    return fn();
  }

  let ran = false;

  try {
    const result = await Sentry.startSpan(context, async (span: SpanLike) => {
      ran = true;
      return fn(span);
    });

    if (ran) {
      return result;
    }
  } catch (error) {
    if (!ran) {
      return fn();
    }
    throw error;
  }

  return fn();
}

export function WatchlistCard() {
  const [items, setItems] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addError, setAddError] = useState<AddTickerError | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  const { pricesMap, isLoading, errorSymbols } = useWatchlistPrices(items);
  const { logger } = Sentry;

  useEffect(() => {
    let mounted = true;
    async function load() {
      await runWithSpan(
        { op: 'ui.load', name: 'Load Watchlist' },
        async (span) => {
          try {
            const res = await fetch('/api/watchlist');
            span?.setAttribute?.('http.status_code', res.status);

            if (!res.ok) throw new Error('Failed to load');
            const json = await res.json();

            if (mounted && json.success) {
              setItems(json.data.watchlist);
              span?.setAttribute?.(
                'watchlist.count',
                json.data.watchlist.length
              );
            } else if (mounted) {
              throw new Error(json.error?.message || 'Failed to load');
            }
          } catch (e) {
            Sentry.captureException(e);
            console.error('Failed to load watchlist', e);
            if (mounted) setLoadError(true);
          } finally {
            if (mounted) setInitialLoading(false);
          }
        }
      );
    }
    load();
    return () => {
      mounted = false;
    };
  }, [retryCount]);

  async function mutate(action: 'add' | 'remove', sym: string) {
    setBusy(true);
    const optimistic = new Set(items);
    if (action === 'add') optimistic.add(sym);
    if (action === 'remove') optimistic.delete(sym);
    const prev = items;
    setItems(Array.from(optimistic));

    try {
      const { res, json } = await runWithSpan(
        { op: 'http.client', name: 'POST /api/watchlist' },
        async (span) => {
          span?.setAttribute?.('watchlist.action', action);
          span?.setAttribute?.('symbol_length', sym.length);
          const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, symbol: sym })
          });
          span?.setAttribute?.('http.status_code', response.status);
          const payload = await response.json();
          return { res: response, json: payload };
        }
      );
      if (!res.ok || !json?.success) {
        setItems(prev);
        return {
          ok: false as const,
          status: res.status,
          message: json?.error?.message || 'Request failed'
        };
      }
      setItems(json.data.watchlist);
      return { ok: true as const };
    } catch (error) {
      Sentry.captureException(error);
      setItems(prev); // rollback
      return { ok: false as const, error };
    } finally {
      setBusy(false);
    }
  }

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const rawSymbol = symbol;
    await runWithSpan({ op: 'ui.submit', name: 'Add ticker' }, async (span) => {
      span?.setAttribute?.('symbol_length', rawSymbol.trim().length);
      logger.info('Add ticker submitted', {
        symbolLength: rawSymbol.trim().length
      });

      const result = validateTicker(rawSymbol);
      if (!result.isValid) {
        const mapped = getAddTickerError({
          type: 'validation',
          message: result.error
        });
        setAddError(mapped);
        logger.warn('Add ticker validation failed', {
          category: mapped.category,
          symbolLength: rawSymbol.trim().length
        });
        return;
      }

      const normalized = normalizeTicker(rawSymbol);
      if (items.includes(normalized)) {
        const mapped = getAddTickerError({ type: 'duplicate' });
        setAddError(mapped);
        logger.info('Add ticker duplicate prevented', {
          category: mapped.category,
          symbolLength: normalized.length
        });
        return;
      }

      const response = await mutate('add', normalized);
      if (!response.ok) {
        const mapped = response.status
          ? getAddTickerError({
              type: 'http',
              status: response.status,
              message: response.message
            })
          : getAddTickerError({ type: 'network', error: response.error });
        setAddError(mapped);
        logger.error('Add ticker request failed', {
          category: mapped.category,
          symbolLength: normalized.length,
          status: response.status
        });
        return;
      }

      setSymbol('');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onAdd} className='mb-3 flex gap-2'>
          <Input
            placeholder='Add symbol (1-5 letters, e.g., MSFT)'
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              if (addError) setAddError(null);
            }}
            className='w-40'
          />
          <Button type='submit' disabled={busy}>
            Add
          </Button>
        </form>
        {initialLoading ? (
          <LoadingSkeleton count={3} />
        ) : loadError ? (
          <div className='flex flex-col items-center gap-2'>
            <div className='text-destructive text-sm'>
              Failed to load watchlist
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setLoadError(false);
                setInitialLoading(true);
                setRetryCount((c) => c + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className='text-muted-foreground text-sm'>No symbols yet.</div>
        ) : isLoading && Object.keys(pricesMap).length === 0 ? (
          <LoadingSkeleton count={items.length} />
        ) : (
          <div className='space-y-2'>
            {items.map((symbol) => {
              const priceData = pricesMap[symbol];
              const hasError = errorSymbols.includes(symbol);
              const isItemLoading = isLoading && !priceData && !hasError;

              const watchlistItem: WatchlistItemWithPrice = {
                id: `watchlist-${symbol}`,
                userId: 'current-user',
                symbol,
                addedAt: new Date(),
                currentPrice: priceData?.price,
                change: priceData?.change,
                changePercent: priceData?.changePercent,
                lastUpdated: priceData?.lastUpdated
              };

              return (
                <WatchlistItemDisplay
                  key={symbol}
                  item={watchlistItem}
                  onRemove={(sym) => mutate('remove', sym)}
                  onClick={(sym) =>
                    useDashboardStore.getState().setSelectedTicker(sym)
                  }
                  isLoading={isItemLoading}
                  isRemoving={busy}
                  error={hasError ? 'Failed to load price' : null}
                />
              );
            })}
          </div>
        )}
        {addError ? (
          <TickerErrorModal
            isOpen={true}
            onClose={() => setAddError(null)}
            title={addError.title}
            description={addError.message}
            nextStep={addError.nextStep}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
