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
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import Link from 'next/link';

const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
const SUGGESTED_WATCHLIST_SYMBOLS = ['AAPL', 'MSFT', 'NVDA'] as const;

type WatchlistLoadIssue = 'auth-config' | 'generic' | null;

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
  const [loadIssue, setLoadIssue] = useState<WatchlistLoadIssue>(null);
  const [addError, setAddError] = useState<AddTickerError | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  const { pricesMap, isLoading, errorSymbols } = useWatchlistPrices(items);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await runWithSpan(
        { op: 'ui.load', name: 'Load Watchlist' },
        async (span) => {
          try {
            const res = await fetch('/api/watchlist', {
              signal: controller.signal
            });
            span?.setAttribute?.('http.status_code', res.status);
            const json = await res.json().catch(() => null);

            if (!res.ok) {
              if (
                json?.error?.code === WATCHLIST_AUTH_MISCONFIGURED_CODE &&
                !controller.signal.aborted
              ) {
                setLoadIssue('auth-config');
                return;
              }

              throw new Error(json?.error?.message || 'Failed to load');
            }

            if (!controller.signal.aborted && json.success) {
              setLoadIssue(null);
              setItems(json.data.watchlist);
              span?.setAttribute?.(
                'watchlist.count',
                json.data.watchlist.length
              );
            } else if (!controller.signal.aborted) {
              throw new Error(json.error?.message || 'Failed to load');
            }
          } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            logger.error('Failed to load watchlist', { error: e });
            if (!controller.signal.aborted) setLoadIssue('generic');
          } finally {
            if (!controller.signal.aborted) setInitialLoading(false);
          }
        }
      );
    }
    load();
    return () => {
      controller.abort();
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
        toast.error('Failed to update watchlist');
        return {
          ok: false as const,
          status: res.status,
          message: json?.error?.message || 'Request failed',
          code: json?.error?.code
        };
      }
      setItems(json.data.watchlist);
      return { ok: true as const };
    } catch (error) {
      logger.error('Watchlist mutation failed', { error });
      setItems(prev); // rollback
      toast.error('Failed to update watchlist');
      return { ok: false as const, error, code: undefined };
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
        if (response.code === WATCHLIST_AUTH_MISCONFIGURED_CODE) {
          setLoadIssue('auth-config');
          return;
        }

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

  const addSuggestedSymbol = async (suggestedSymbol: string) => {
    setSymbol(suggestedSymbol);
    if (items.includes(suggestedSymbol)) {
      return;
    }

    const response = await mutate('add', suggestedSymbol);
    if (!response.ok) {
      if (response.code === WATCHLIST_AUTH_MISCONFIGURED_CODE) {
        setLoadIssue('auth-config');
        return;
      }

      const mapped = response.status
        ? getAddTickerError({
            type: 'http',
            status: response.status,
            message: response.message
          })
        : getAddTickerError({ type: 'network', error: response.error });
      setAddError(mapped);
      return;
    }

    setSymbol('');
  };

  const retryLoad = () => {
    setLoadIssue(null);
    setInitialLoading(true);
    setRetryCount((c) => c + 1);
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
        ) : loadIssue === 'auth-config' ? (
          <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center'>
            <div className='space-y-1'>
              <div className='text-sm font-medium'>
                Watchlist setup required
              </div>
              <p className='text-muted-foreground max-w-sm text-sm'>
                Configure the Clerk Supabase JWT template and Supabase JWT
                verification before loading saved watchlists.
              </p>
            </div>
            <div className='flex flex-wrap justify-center gap-2'>
              <Button asChild variant='outline' size='sm'>
                <Link href='/dashboard/operations'>Open Operations</Link>
              </Button>
              <Button variant='ghost' size='sm' onClick={retryLoad}>
                Retry
              </Button>
            </div>
          </div>
        ) : loadIssue === 'generic' ? (
          <div className='flex flex-col items-center gap-2'>
            <div className='text-destructive text-sm'>
              Failed to load watchlist
            </div>
            <Button variant='outline' size='sm' onClick={retryLoad}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className='rounded-lg border border-dashed p-6 text-center'>
            <div className='space-y-2'>
              <div className='text-sm font-medium'>Build your watchlist</div>
              <p className='text-muted-foreground mx-auto max-w-sm text-sm'>
                Add symbols you want to monitor. Start with one of these, or use
                the input above.
              </p>
            </div>
            <div className='mt-4 flex flex-wrap justify-center gap-2'>
              {SUGGESTED_WATCHLIST_SYMBOLS.map((suggestedSymbol) => (
                <Button
                  key={suggestedSymbol}
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={busy}
                  onClick={() => addSuggestedSymbol(suggestedSymbol)}
                >
                  {suggestedSymbol}
                </Button>
              ))}
            </div>
          </div>
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
