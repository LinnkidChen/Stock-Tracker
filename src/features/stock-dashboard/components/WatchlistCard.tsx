'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { WatchlistItemDisplay } from './WatchlistItemDisplay';
import { LoadingSkeleton } from './LoadingSkeleton';
import { WatchlistItemWithPrice } from '@/types/stocks';

export function WatchlistCard() {
  const [items, setItems] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { pricesMap, isLoading, errorSymbols } = useWatchlistPrices(items);

  async function mutate(action: 'add' | 'remove', sym: string) {
    setBusy(true);
    setError(null);
    const optimistic = new Set(items);
    if (action === 'add') optimistic.add(sym);
    if (action === 'remove') optimistic.delete(sym);
    const prev = items;
    setItems(Array.from(optimistic));

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, symbol: sym })
      });
      const json = await res.json();
      if (!res.ok || !json?.success)
        throw new Error(json?.error?.message || 'Request failed');
      setItems(json.data.watchlist);
    } catch (e: any) {
      setItems(prev); // rollback
      setError(e?.message ?? 'Failed to update watchlist');
    } finally {
      setBusy(false);
    }
  }

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateTicker(symbol);
    if (!result.isValid) {
      setError(result.error ?? 'Invalid symbol');
      return;
    }
    await mutate('add', normalizeTicker(symbol));
    setSymbol('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onAdd} className='mb-3 flex gap-2'>
          <Input
            placeholder='Add symbol (e.g., MSFT)'
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            className='w-40'
          />
          <Button type='submit' disabled={busy}>
            Add
          </Button>
        </form>
        {error && <div className='mb-2 text-sm text-red-600'>{error}</div>}
        {items.length === 0 ? (
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
                  isLoading={isItemLoading}
                  isRemoving={busy}
                  error={hasError ? 'Failed to load price' : null}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
