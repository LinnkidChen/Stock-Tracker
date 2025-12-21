'use client';

import { useEffect, useRef } from 'react';
import { MarketOverview } from './MarketOverview';
import { WatchlistCard } from './WatchlistCard';
import { PortfolioCard } from './PortfolioCard';
import { TickerInput } from './TickerInput';

import { useDashboardStore } from '../store';

import { QuoteProviderToggle } from './QuoteProviderToggle';

export function DashboardClient() {
  const { hydrateFromStorage } = useDashboardStore();
  const tickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus ticker input on "/" key
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        tickerInputRef.current?.focus();
      }

      // Clear selection on Escape
      if (e.key === 'Escape') {
        tickerInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className='space-y-6' role='main' aria-label='Stock Dashboard'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Stock Dashboard</h1>
        <div className='flex items-center gap-4'>
          <QuoteProviderToggle />
          <TickerInput ref={tickerInputRef} />
        </div>
      </div>

      <MarketOverview />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <WatchlistCard />
        <PortfolioCard />
      </div>

      {/* Keyboard shortcuts help */}
      <div className='text-muted-foreground border-t pt-4 text-xs'>
        <span className='font-medium'>Keyboard shortcuts:</span> Press{' '}
        <code>/</code> to focus search, Enter to search, Esc to clear focus
      </div>
    </div>
  );
}
