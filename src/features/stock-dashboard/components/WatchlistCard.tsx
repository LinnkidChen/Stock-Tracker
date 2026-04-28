'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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
import type { WatchlistItem as ApiWatchlistItem } from '@/types/watchlist';
import { Loader2, RefreshCw } from 'lucide-react';

const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
const SUGGESTED_WATCHLIST_SYMBOLS = ['AAPL', 'MSFT', 'NVDA'] as const;

type WatchlistLoadIssue = 'auth-config' | 'generic' | null;

type SpanLike = {
  setAttribute?: (key: string, value: string | number) => void;
};

type WatchlistMutationResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      status?: number;
      message?: string;
      error?: unknown;
      code?: string;
    };

const NOTE_MAX_LENGTH = 500;
const UNGROUPED_LABEL = 'Ungrouped';
const WATCHLIST_REFRESH_INTERVAL_MS = 60_000;
const WATCHLIST_STALE_AFTER_MS = 60_000;

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

function normalizeExchangeInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeNoteInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getGroupKey(item: ApiWatchlistItem): string {
  return item.exchange?.trim() || '';
}

function getGroupLabel(groupKey: string): string {
  return groupKey || UNGROUPED_LABEL;
}

function compareGroupKeys(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareWatchlistItems(
  a: ApiWatchlistItem,
  b: ApiWatchlistItem
): number {
  const groupCompare = compareGroupKeys(getGroupKey(a), getGroupKey(b));
  if (groupCompare !== 0) return groupCompare;

  const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sortA !== sortB) return sortA - sortB;

  const createdA = Date.parse(a.created_at) || 0;
  const createdB = Date.parse(b.created_at) || 0;
  if (createdA !== createdB) return createdA - createdB;

  return a.symbol.localeCompare(b.symbol);
}

function getResponseItems(json: any): ApiWatchlistItem[] {
  if (Array.isArray(json?.data?.items)) {
    return json.data.items;
  }

  if (Array.isArray(json?.data?.watchlist)) {
    const now = new Date().toISOString();
    return json.data.watchlist.map((symbol: string) => ({
      id: `watchlist-${symbol}`,
      symbol,
      exchange: null,
      note: null,
      sort_order: null,
      created_at: now,
      updated_at: now
    }));
  }

  return [];
}

function createOptimisticItem(
  symbol: string,
  exchange: string | null,
  note: string | null,
  items: ApiWatchlistItem[]
): ApiWatchlistItem {
  const now = new Date().toISOString();
  const groupKey = exchange ?? '';
  const groupOrders = items
    .filter((item) => getGroupKey(item) === groupKey)
    .map((item) => item.sort_order)
    .filter((sortOrder): sortOrder is number => typeof sortOrder === 'number');

  return {
    id: `watchlist-${symbol}`,
    symbol,
    exchange,
    note,
    sort_order: groupOrders.length > 0 ? Math.max(...groupOrders) + 1 : 0,
    created_at: now,
    updated_at: now
  };
}

function toPricedItem(
  item: ApiWatchlistItem,
  priceData: ReturnType<typeof useWatchlistPrices>['pricesMap'][string] | undefined
): WatchlistItemWithPrice {
  return {
    id: item.id,
    userId: 'current-user',
    symbol: item.symbol,
    addedAt: new Date(item.created_at),
    exchange: item.exchange,
    note: item.note,
    sort_order: item.sort_order,
    currentPrice: priceData?.price,
    change: priceData?.change,
    changePercent: priceData?.changePercent,
    lastUpdated: priceData?.lastUpdated
  };
}

function formatRefreshStatus(
  lastRefreshedAt: Date | null,
  hasStaleQuotes: boolean,
  isRefreshing: boolean
): string {
  if (isRefreshing) return 'Refreshing...';
  if (hasStaleQuotes) return 'Some quotes stale';
  if (!lastRefreshedAt) return 'Not refreshed yet';

  const elapsedMs = Date.now() - lastRefreshedAt.getTime();
  if (elapsedMs < 60_000) return 'Updated just now';

  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  return `Updated ${elapsedMinutes}m ago`;
}

export function WatchlistCard() {
  const [items, setItems] = useState<ApiWatchlistItem[]>([]);
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reorderingSymbol, setReorderingSymbol] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadIssue, setLoadIssue] = useState<WatchlistLoadIssue>(null);
  const [addError, setAddError] = useState<AddTickerError | null>(null);
  const [editingItem, setEditingItem] = useState<ApiWatchlistItem | null>(null);
  const [editExchange, setEditExchange] = useState('');
  const [editNote, setEditNote] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const symbols = useMemo(() => items.map((item) => item.symbol), [items]);
  const sortedItems = useMemo(
    () => [...items].sort(compareWatchlistItems),
    [items]
  );
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ApiWatchlistItem[]>();

    sortedItems.forEach((item) => {
      const groupKey = getGroupKey(item);
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
    });

    return Array.from(groups.entries()).sort(([a], [b]) =>
      compareGroupKeys(a, b)
    );
  }, [sortedItems]);

  const {
    pricesMap,
    isLoading,
    isRefreshing,
    errorSymbols,
    staleSymbols,
    lastRefreshedAt,
    refreshAll
  } = useWatchlistPrices(symbols, {
    autoRefresh,
    refreshIntervalMs: WATCHLIST_REFRESH_INTERVAL_MS,
    staleAfterMs: WATCHLIST_STALE_AFTER_MS
  });
  const staleSymbolSet = useMemo(() => new Set(staleSymbols), [staleSymbols]);
  const refreshStatus = formatRefreshStatus(
    lastRefreshedAt,
    staleSymbols.length > 0,
    isRefreshing
  );

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
              const nextItems = getResponseItems(json);
              setItems(nextItems);
              span?.setAttribute?.('watchlist.count', nextItems.length);
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

  async function mutate(
    action: 'add' | 'remove',
    sym: string,
    metadata: { exchange?: string | null; note?: string | null } = {}
  ): Promise<WatchlistMutationResponse> {
    setBusy(true);
    const prev = items;

    if (action === 'add') {
      setItems((currentItems) => [
        ...currentItems,
        createOptimisticItem(
          sym,
          metadata.exchange ?? null,
          metadata.note ?? null,
          currentItems
        )
      ]);
    }

    if (action === 'remove') {
      setItems((currentItems) =>
        currentItems.filter((item) => item.symbol !== sym)
      );
    }

    try {
      const { res, json } = await runWithSpan(
        { op: 'http.client', name: 'POST /api/watchlist' },
        async (span) => {
          span?.setAttribute?.('watchlist.action', action);
          span?.setAttribute?.('symbol_length', sym.length);
          const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              symbol: sym,
              ...(action === 'add' ? metadata : {})
            })
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
          ok: false,
          status: res.status,
          message: json?.error?.message || 'Request failed',
          code: json?.error?.code
        };
      }
      setItems(getResponseItems(json));
      return { ok: true };
    } catch (error) {
      logger.error('Watchlist mutation failed', { error });
      setItems(prev);
      toast.error('Failed to update watchlist');
      return { ok: false as const, error, code: undefined };
    } finally {
      setBusy(false);
    }
  }

  async function updateMetadata() {
    if (!editingItem) return;
    const normalizedExchange = normalizeExchangeInput(editExchange);
    const normalizedNote = normalizeNoteInput(editNote);

    if ((normalizedNote?.length ?? 0) > NOTE_MAX_LENGTH) {
      toast.error('Note must be 500 characters or less');
      return;
    }

    setBusy(true);
    const prev = items;
    const updatedAt = new Date().toISOString();
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.symbol === editingItem.symbol
          ? {
              ...item,
              exchange: normalizedExchange,
              note: normalizedNote,
              updated_at: updatedAt
            }
          : item
      )
    );

    try {
      const response = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          symbol: editingItem.symbol,
          exchange: normalizedExchange,
          note: normalizedNote
        })
      });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        setItems(prev);
        toast.error('Failed to update watchlist item');
        return;
      }

      setItems(getResponseItems(json));
      setEditingItem(null);
    } catch (error) {
      logger.error('Watchlist metadata update failed', { error });
      setItems(prev);
      toast.error('Failed to update watchlist item');
    } finally {
      setBusy(false);
    }
  }

  async function reorderWithinGroup(symbolToMove: string, direction: -1 | 1) {
    const currentItem = items.find((item) => item.symbol === symbolToMove);
    if (!currentItem) return;

    const groupKey = getGroupKey(currentItem);
    const groupItems = sortedItems.filter((item) => getGroupKey(item) === groupKey);
    const currentIndex = groupItems.findIndex(
      (item) => item.symbol === symbolToMove
    );
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groupItems.length) {
      return;
    }

    const reorderedGroup = [...groupItems];
    const [movedItem] = reorderedGroup.splice(currentIndex, 1);
    reorderedGroup.splice(nextIndex, 0, movedItem);

    const orderBySymbol = new Map(
      reorderedGroup.map((item, index) => [item.symbol, index])
    );
    const prev = items;
    const nextItems = items.map((item) =>
      orderBySymbol.has(item.symbol)
        ? { ...item, sort_order: orderBySymbol.get(item.symbol)! }
        : item
    );

    setReorderingSymbol(symbolToMove);
    setItems(nextItems);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          items: reorderedGroup.map((item, index) => ({
            symbol: item.symbol,
            sort_order: index
          }))
        })
      });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        setItems(prev);
        toast.error('Failed to reorder watchlist');
        return;
      }

      setItems(getResponseItems(json));
    } catch (error) {
      logger.error('Watchlist reorder failed', { error });
      setItems(prev);
      toast.error('Failed to reorder watchlist');
    } finally {
      setReorderingSymbol(null);
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
      if (items.some((item) => item.symbol === normalized)) {
        const mapped = getAddTickerError({ type: 'duplicate' });
        setAddError(mapped);
        logger.info('Add ticker duplicate prevented', {
          category: mapped.category,
          symbolLength: normalized.length
        });
        return;
      }

      const normalizedNote = normalizeNoteInput(note);
      if ((normalizedNote?.length ?? 0) > NOTE_MAX_LENGTH) {
        toast.error('Note must be 500 characters or less');
        return;
      }

      const response = await mutate('add', normalized, {
        exchange: normalizeExchangeInput(exchange),
        note: normalizedNote
      });
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
      setExchange('');
      setNote('');
    });
  };

  const addSuggestedSymbol = async (suggestedSymbol: string) => {
    setSymbol(suggestedSymbol);
    if (items.some((item) => item.symbol === suggestedSymbol)) {
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

  function openEditDialog(item: WatchlistItemWithPrice) {
    const sourceItem = items.find((candidate) => candidate.symbol === item.symbol);
    if (!sourceItem) return;

    setEditingItem(sourceItem);
    setEditExchange(sourceItem.exchange ?? '');
    setEditNote(sourceItem.note ?? '');
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle>Watchlist</CardTitle>
          <div className='flex flex-wrap items-center gap-3'>
            <span className='text-muted-foreground text-xs'>
              {refreshStatus}
            </span>
            <div className='flex items-center gap-2'>
              <Switch
                id='watchlist-auto-refresh'
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                aria-label='Auto refresh watchlist'
              />
              <Label
                htmlFor='watchlist-auto-refresh'
                className='text-muted-foreground text-xs font-normal'
              >
                Auto refresh
              </Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => refreshAll()}
                  disabled={symbols.length === 0 || isRefreshing}
                  aria-label='Refresh watchlist prices'
                  className='size-8'
                >
                  {isRefreshing ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <RefreshCw className='h-4 w-4' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh prices</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onAdd} className='mb-4 grid gap-2 sm:grid-cols-4'>
          <Input
            placeholder='Add symbol (1-5 letters, e.g., MSFT)'
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              if (addError) setAddError(null);
            }}
            className='sm:col-span-2'
          />
          <Input
            placeholder='Exchange'
            value={exchange}
            onChange={(e) => setExchange(e.target.value.toUpperCase())}
          />
          <Button type='submit' disabled={busy}>
            Add
          </Button>
          <Textarea
            placeholder='Note'
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            className='min-h-10 resize-none sm:col-span-4'
          />
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
          <div className='space-y-4'>
            {groupedItems.map(([groupKey, groupItems]) => (
              <section key={groupKey || 'ungrouped'} className='space-y-2'>
                <h3 className='text-muted-foreground text-xs font-semibold tracking-normal'>
                  {getGroupLabel(groupKey)}
                </h3>
                <div className='space-y-2'>
                  {groupItems.map((item, index) => {
                    const symbol = item.symbol;
                    const priceData = pricesMap[symbol];
                    const hasError = errorSymbols.includes(symbol);
                    const isItemLoading = isLoading && !priceData && !hasError;
                    const watchlistItem = toPricedItem(item, priceData);

                    return (
                      <WatchlistItemDisplay
                        key={item.id}
                        item={watchlistItem}
                        onRemove={(sym) => mutate('remove', sym)}
                        onEdit={openEditDialog}
                        onMoveUp={(sym) => reorderWithinGroup(sym, -1)}
                        onMoveDown={(sym) => reorderWithinGroup(sym, 1)}
                        onClick={(sym) =>
                          useDashboardStore.getState().setSelectedTicker(sym)
                        }
                        isLoading={isItemLoading}
                        isRemoving={busy}
                        isReordering={reorderingSymbol === symbol}
                        isStale={staleSymbolSet.has(symbol)}
                        canMoveUp={index > 0}
                        canMoveDown={index < groupItems.length - 1}
                        error={hasError ? 'Failed to load price' : null}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
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
      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editingItem ? editingItem.symbol : 'watchlist item'}
            </DialogTitle>
            <DialogDescription>
              Update the exchange group and research note.
            </DialogDescription>
          </DialogHeader>
          <form
            className='space-y-4'
            onSubmit={(event) => {
              event.preventDefault();
              updateMetadata();
            }}
          >
            <div className='space-y-2'>
              <Label htmlFor='watchlist-edit-exchange'>Exchange</Label>
              <Input
                id='watchlist-edit-exchange'
                value={editExchange}
                onChange={(e) => setEditExchange(e.target.value.toUpperCase())}
                placeholder='Exchange'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='watchlist-edit-note'>Note</Label>
              <Textarea
                id='watchlist-edit-note'
                value={editNote}
                maxLength={NOTE_MAX_LENGTH}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder='Note'
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type='button' variant='outline'>
                  Cancel
                </Button>
              </DialogClose>
              <Button type='submit' disabled={busy}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
