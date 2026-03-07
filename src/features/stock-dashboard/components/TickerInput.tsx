'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { useDashboardStore } from '../store';
import { mockStocks } from '@/lib/mock-data/stocks';

interface TickerInputProps {
  onTickerSubmit?: (ticker: string) => void;
}

export const TickerInput = forwardRef<HTMLInputElement, TickerInputProps>(
  ({ onTickerSubmit }, ref) => {
    const [ticker, setTicker] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const containerRef = useRef<HTMLFormElement | null>(null);
    const { setSelectedTicker } = useDashboardStore();

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (/[,\s]+/.test(ticker.trim())) {
        setError('Multiple tickers are not supported. Enter one symbol.');
        return;
      }
      const res = validateTicker(ticker);
      if (!res.isValid) {
        setError(res.error ?? 'Invalid symbol');
        return;
      }
      const sym = normalizeTicker(ticker);
      if (onTickerSubmit) {
        onTickerSubmit(sym);
      } else {
        setSelectedTicker(sym);
      }
      setTicker('');
      setIsFocused(false);
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
      return mockStocks
        .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
        .slice(0, 8)
        .map((s) => ({ symbol: s.symbol, name: s.name }));
    }, [debounced]);

    // Close suggestions on outside click
    useEffect(() => {
      function onClick(e: MouseEvent) {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(e.target as Node))
          setIsFocused(false);
      }
      window.addEventListener('click', onClick);
      return () => window.removeEventListener('click', onClick);
    }, []);

    const showSuggestions = isFocused && suggestions.length > 0;

    return (
      <form onSubmit={handleSubmit} className='flex gap-2' ref={containerRef}>
        <div className='relative'>
          <Input
            ref={ref}
            placeholder='Enter ticker (e.g., AAPL)'
            value={ticker}
            onFocus={() => setIsFocused(true)}
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
          {showSuggestions && (
            <div className='bg-popover absolute z-10 mt-1 w-80 rounded-md border p-1 shadow-sm'>
              {suggestions.map((s) => (
                <button
                  type='button'
                  key={s.symbol}
                  className='hover:bg-accent flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left'
                  onClick={() => {
                    setTicker(s.symbol);
                    setIsFocused(false);
                    setError(null);
                  }}
                >
                  <span className='font-medium'>{s.symbol}</span>
                  <span className='text-muted-foreground text-xs'>
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type='submit'>Search</Button>
      </form>
    );
  }
);

TickerInput.displayName = 'TickerInput';
