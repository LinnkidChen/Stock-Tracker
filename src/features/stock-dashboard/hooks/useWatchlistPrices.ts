'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { StockQuote } from '@/lib/types/stock-api';
import { WatchlistPricesMap } from '@/types/stocks';
import { useDashboardStore } from '../store';
import { usePriceStream } from './usePriceStream';
import {
  isLongbridgeCredentialError,
  readStockApiResponse
} from '../lib/stock-api-error';

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_STALE_AFTER_MS = 60_000;

async function fetchStockQuote(
  symbol: string,
  provider: string
): Promise<StockQuote> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const searchParams = new URLSearchParams({ provider });
    const response = await fetch(
      `/api/stocks/quote/${symbol}?${searchParams}`,
      {
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    return await readStockApiResponse<StockQuote>(
      response,
      `Failed to fetch stock quote: ${response.statusText}`
    );
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export interface UseWatchlistPricesResult {
  pricesMap: WatchlistPricesMap;
  isLoading: boolean;
  isRefreshing: boolean;
  hasErrors: boolean;
  errorSymbols: string[];
  staleSymbols: string[];
  lastRefreshedAt: Date | null;
  symbolMeta: Record<
    string,
    {
      isFetching: boolean;
      isLoading: boolean;
      isStale: boolean;
      updatedAt: Date | null;
    }
  >;
  refreshAll: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface UseWatchlistPricesOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
  staleAfterMs?: number;
}

export function useWatchlistPrices(
  symbols: string[],
  options: UseWatchlistPricesOptions = {}
): UseWatchlistPricesResult {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);
  const {
    autoRefresh = false,
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS
  } = options;
  const [now, setNow] = useState(() => Date.now());
  const uniqueSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
        )
      ),
    [symbols]
  );
  const { pricesMap: streamPricesMap, errorSymbols: streamErrorSymbols } =
    usePriceStream(uniqueSymbols, quoteProvider);
  const refetchInterval: number | false = autoRefresh
    ? refreshIntervalMs
    : false;

  useEffect(() => {
    if (uniqueSymbols.length === 0) return;

    const tickMs = Math.min(Math.max(staleAfterMs, 1000), 60_000);
    const intervalId = window.setInterval(() => setNow(Date.now()), tickMs);

    return () => window.clearInterval(intervalId);
  }, [staleAfterMs, uniqueSymbols.length]);

  const results = useQueries({
    queries: uniqueSymbols.map((symbol) => ({
      queryKey: ['stock-quote', symbol, quoteProvider],
      queryFn: () => fetchStockQuote(symbol, quoteProvider),
      staleTime: staleAfterMs,
      refetchInterval,
      refetchIntervalInBackground: false,
      retry: (failureCount: number, error: Error) =>
        !isLongbridgeCredentialError(error) && failureCount < 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000)
    }))
  });

  const httpPricesMap: WatchlistPricesMap = {};
  const errorSymbols = new Set<string>(streamErrorSymbols);
  const staleSymbols: string[] = [];
  const symbolMeta: UseWatchlistPricesResult['symbolMeta'] = {};
  const updatedTimes: number[] = [];
  let hasAnyLoading = false;
  let hasAnyFetching = false;

  results.forEach((result, index) => {
    const symbol = uniqueSymbols[index];
    const streamPrice = streamPricesMap[symbol];
    const updatedAtMs = result.dataUpdatedAt || 0;
    const updatedAt = updatedAtMs ? new Date(updatedAtMs) : null;
    const isStale =
      Boolean(result.data) &&
      updatedAtMs > 0 &&
      now - updatedAtMs > staleAfterMs;

    if (result.isLoading && !streamPrice) {
      hasAnyLoading = true;
    }

    if (result.isFetching) {
      hasAnyFetching = true;
    }

    if (isStale) {
      staleSymbols.push(symbol);
    }

    symbolMeta[symbol] = {
      isFetching: result.isFetching,
      isLoading: result.isLoading && !streamPrice,
      isStale,
      updatedAt
    };

    if (updatedAtMs > 0) {
      updatedTimes.push(updatedAtMs);
    }

    if (result.error && !streamPrice) {
      errorSymbols.add(symbol);
    } else if (result.data) {
      httpPricesMap[symbol] = {
        price: result.data.price,
        change: result.data.change,
        changePercent: result.data.changePercent,
        lastUpdated: new Date(result.data.lastUpdated)
      };
    }
  });

  const pricesMap: WatchlistPricesMap = {
    ...httpPricesMap,
    ...streamPricesMap
  };

  Object.keys(pricesMap).forEach((symbol) => {
    errorSymbols.delete(symbol);
  });

  const refreshAll = async () => {
    await Promise.all(results.map((result) => result.refetch()));
  };

  const lastRefreshedAt =
    updatedTimes.length > 0 ? new Date(Math.max(...updatedTimes)) : null;

  return {
    pricesMap,
    isLoading: hasAnyLoading,
    isRefreshing: hasAnyFetching && !hasAnyLoading,
    hasErrors: errorSymbols.size > 0,
    errorSymbols: Array.from(errorSymbols),
    staleSymbols,
    lastRefreshedAt,
    symbolMeta,
    refreshAll,
    refetch: refreshAll
  };
}
