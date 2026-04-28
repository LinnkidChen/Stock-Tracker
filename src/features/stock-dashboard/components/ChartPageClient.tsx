'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuoteProviderToggle } from './QuoteProviderToggle';
import { useDashboardStore } from '../store';
import { KLineChart } from './KLineChart';
import { TickerInput } from './TickerInput';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineInterval
} from '@/lib/types/stock-api';
import {
  buildChartsHref,
  isChartRange,
  type ChartPreferences,
  type ChartRange
} from '../lib/chart-workspace';

const SUGGESTED_CHART_SYMBOLS = ['AAPL', 'MSFT', 'NVDA'] as const;

export function ChartPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    selectedTicker,
    setSelectedTicker,
    quoteProvider,
    hydrateFromStorage,
    chartWorkspace,
    setChartWorkspace,
    setChartPreferences
  } = useDashboardStore();
  const [hydrated, setHydrated] = useState(false);

  const symbol = useMemo(() => {
    const rawSymbol = searchParams.get('symbol')?.trim();
    return rawSymbol ? rawSymbol.toUpperCase() : null;
  }, [searchParams]);
  const rawInterval = searchParams.get('interval')?.toLowerCase();
  const queryInterval = isKLineInterval(rawInterval)
    ? rawInterval
    : null;
  const rawRange = searchParams.get('range')?.toLowerCase();
  const queryRange = isChartRange(rawRange) ? rawRange : null;

  const interval: KLineInterval =
    queryInterval ?? chartWorkspace.interval ?? DEFAULT_KLINE_INTERVAL;
  const range: ChartRange = queryRange ?? chartWorkspace.range;
  const activeTicker = symbol ?? chartWorkspace.symbol ?? selectedTicker;
  const workspaceSymbol = activeTicker ?? null;

  useEffect(() => {
    hydrateFromStorage();
    setHydrated(true);
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (activeTicker && activeTicker !== selectedTicker) {
      setSelectedTicker(activeTicker);
    }

    if (
      chartWorkspace.symbol !== workspaceSymbol ||
      chartWorkspace.interval !== interval ||
      chartWorkspace.range !== range
    ) {
      setChartWorkspace({
        symbol: workspaceSymbol,
        interval,
        range
      });
    }
  }, [
    activeTicker,
    chartWorkspace.interval,
    chartWorkspace.range,
    chartWorkspace.symbol,
    hydrated,
    interval,
    range,
    selectedTicker,
    setChartWorkspace,
    setSelectedTicker,
    workspaceSymbol
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const nextWorkspace = {
      ...(!symbol && activeTicker ? { symbol: activeTicker } : {}),
      ...(!queryInterval ? { interval } : {}),
      ...(!queryRange ? { range } : {})
    };

    if (Object.keys(nextWorkspace).length === 0) {
      return;
    }

    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        nextWorkspace
      )
    );
  }, [
    activeTicker,
    hydrated,
    interval,
    queryInterval,
    queryRange,
    range,
    router,
    searchParams,
    symbol
  ]);

  const handleTickerSubmit = (ticker: string) => {
    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        {
          symbol: ticker,
          interval,
          range
        }
      )
    );
  };

  const handleIntervalChange = (nextInterval: KLineInterval) => {
    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        {
          symbol: activeTicker,
          interval: nextInterval,
          range
        }
      )
    );
  };

  const handleRangeChange = (nextRange: ChartRange) => {
    router.replace(
      buildChartsHref(
        new URLSearchParams(searchParams.toString()),
        {
          symbol: activeTicker,
          interval,
          range: nextRange
        }
      )
    );
  };

  const handlePreferencesChange = (
    preferences: Partial<ChartPreferences>
  ) => {
    setChartPreferences(preferences);
  };

  return (
    <div className='flex h-full flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Technical Analysis</h1>
        <div className='flex items-center gap-4'>
          <QuoteProviderToggle />
          <div className='w-[300px]'>
            <TickerInput onTickerSubmit={handleTickerSubmit} />
          </div>
        </div>
      </div>

      <div className='flex-1'>
        {activeTicker ? (
          <KLineChart
            ticker={activeTicker}
            provider={quoteProvider}
            interval={interval}
            onIntervalChange={handleIntervalChange}
            range={range}
            onRangeChange={handleRangeChange}
            preferences={chartWorkspace.preferences}
            onPreferencesChange={handlePreferencesChange}
            className='h-full'
          />
        ) : (
          <Card className='flex min-h-[400px] items-center justify-center'>
            <CardContent className='space-y-5 pt-6 text-center'>
              <div className='space-y-2'>
                <h2 className='text-xl font-semibold'>Choose a ticker</h2>
                <p className='text-muted-foreground max-w-md text-sm'>
                  Search for a symbol or start with a commonly watched ticker to
                  open the technical analysis chart.
                </p>
              </div>
              <div className='flex flex-wrap justify-center gap-2'>
                {SUGGESTED_CHART_SYMBOLS.map((suggestedSymbol) => (
                  <Button
                    key={suggestedSymbol}
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleTickerSubmit(suggestedSymbol)}
                  >
                    {suggestedSymbol}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
