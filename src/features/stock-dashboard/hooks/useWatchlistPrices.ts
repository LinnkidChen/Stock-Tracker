'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { StockQuote, APIResponse } from '@/lib/types/stock-api';
import { WatchlistPricesMap } from '@/types/stocks';
import { useDashboardStore } from '../store';
import { usePriceStream } from './usePriceStream';

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

    if (!response.ok) {
      throw new Error(`Failed to fetch stock quote: ${response.statusText}`);
    }

    const apiResponse: APIResponse<StockQuote> = await response.json();

    if (!apiResponse.success || !apiResponse.data) {
      throw new Error(
        apiResponse.error?.message || 'Failed to fetch stock data'
      );
    }

    return apiResponse.data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export interface UseWatchlistPricesResult {
  pricesMap: WatchlistPricesMap;
  isLoading: boolean;
  hasErrors: boolean;
  errorSymbols: string[];
  refetch: () => void;
}

export function useWatchlistPrices(
  symbols: string[]
): UseWatchlistPricesResult {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);
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

  const results = useQueries({
    queries: uniqueSymbols.map((symbol) => ({
      queryKey: ['stock-quote', symbol, quoteProvider],
      queryFn: () => fetchStockQuote(symbol, quoteProvider),
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: false as const,
      retry: 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000)
    }))
  });

  const httpPricesMap: WatchlistPricesMap = {};
  const errorSymbols = new Set<string>(streamErrorSymbols);
  let hasAnyLoading = false;

  results.forEach((result, index) => {
    const symbol = uniqueSymbols[index];
    const streamPrice = streamPricesMap[symbol];

    if (result.isLoading && !streamPrice) {
      hasAnyLoading = true;
    } else if (result.error && !streamPrice) {
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

  const refetch = () => {
    results.forEach((result) => result.refetch());
  };

  return {
    pricesMap,
    isLoading: hasAnyLoading,
    hasErrors: errorSymbols.size > 0,
    errorSymbols: Array.from(errorSymbols),
    refetch
  };
}
