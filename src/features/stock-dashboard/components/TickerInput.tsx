'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { useDashboardStore } from '../store';
import { mockStocks } from '@/lib/mock-data/stocks';

interface TickerInputProps {
  ref?: React.Ref<HTMLInputElement>;
}

export function TickerInput({ ref: forwardedRef }: TickerInputProps) {
  const [ticker, setTicker] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setSelectedTicker } = useDashboardStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateTicker(ticker);
    if (!res.isValid) {
      setError(res.error ?? 'Invalid symbol');
      return;
    }
    const sym = normalizeTicker(ticker);
    setSelectedTicker(sym);
    setTicker('');
    setOpen(false);
    setError(null);
  };

  // Debounce suggestions after user types 2+ chars
  useEffect(() => {
    setQuery(ticker);
  }, [ticker]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const suggestions = useMemo(() => {
    const q = debounced.trim().toUpperCase();
    if (q.length < 2) return [] as { symbol: string; name: string }[];
    const candidates = mockStocks
      .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
      .slice(0, 8)
      .map((s) => ({ symbol: s.symbol, name: s.name }));
    setOpen(candidates.length > 0);
    return candidates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Close suggestions on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <form onSubmit={handleSubmit} className='flex gap-2' ref={containerRef}>
      <div className='relative'>
        <Input
          ref={forwardedRef}
          placeholder='Enter ticker (e.g., AAPL)'
          value={ticker}
          onChange={(e) => {
            setTicker(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          className='w-48'
          aria-invalid={!!error}
          aria-autocomplete='list'
          aria-label='Enter stock ticker symbol'
          aria-describedby={error ? 'ticker-error' : undefined}
          autoComplete='off'
        />
        {error && (
          <div
            id='ticker-error'
            className='absolute -bottom-6 left-0 text-xs text-red-600'
            role='alert'
          >
            {error}
          </div>
        )}
        {open && suggestions.length > 0 && (
          <div className='bg-popover absolute z-10 mt-1 w-80 rounded-md border p-1 shadow-sm'>
            {suggestions.map((s) => (
              <button
                type='button'
                key={s.symbol}
                className='hover:bg-accent flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left'
                onClick={() => {
                  setTicker(s.symbol);
                  setOpen(false);
                  setError(null);
                }}
              >
                <span className='font-medium'>{s.symbol}</span>
                <span className='text-muted-foreground text-xs'>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button type='submit'>Search</Button>
    </form>
  );
}
