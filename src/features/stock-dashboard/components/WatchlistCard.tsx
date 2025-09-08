'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeTicker, validateTicker } from '@/lib/validation/ticker';
import { mockStocks } from '@/lib/mock-data/stocks';

export function WatchlistCard() {
  const [items, setItems] = useState<string[]>(mockStocks.map((s) => s.symbol));
  const [symbol, setSymbol] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        ) : (
          <ul className='space-y-2'>
            {items.map((s) => (
              <li key={s} className='flex items-center justify-between'>
                <span className='font-medium'>{s}</span>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={busy}
                  onClick={() => mutate('remove', s)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
