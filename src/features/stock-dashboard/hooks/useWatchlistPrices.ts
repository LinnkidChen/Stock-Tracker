'use client';

import { useQueries } from '@tanstack/react-query';
import { StockQuote, APIResponse } from '@/lib/types/stock-api';
import { WatchlistPricesMap } from '@/types/stocks';

async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`/api/stocks/quote/${symbol}`, {
      signal: controller.signal
    });
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
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));

  const results = useQueries({
    queries: uniqueSymbols.map((symbol) => ({
      queryKey: ['stock-quote', symbol],
      queryFn: () => fetchStockQuote(symbol),
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: false as const,
      retry: 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000)
    }))
  });

  const pricesMap: WatchlistPricesMap = {};
  const errorSymbols: string[] = [];
  let hasAnyLoading = false;

  results.forEach((result, index) => {
    const symbol = uniqueSymbols[index];

    if (result.isLoading) {
      hasAnyLoading = true;
    } else if (result.error) {
      errorSymbols.push(symbol);
    } else if (result.data) {
      pricesMap[symbol] = {
        price: result.data.price,
        change: result.data.change,
        changePercent: result.data.changePercent,
        lastUpdated: new Date(result.data.lastUpdated)
      };
    }
  });

  const refetch = () => {
    results.forEach((result) => result.refetch());
  };

  return {
    pricesMap,
    isLoading: hasAnyLoading,
    hasErrors: errorSymbols.length > 0,
    errorSymbols,
    refetch
  };
}
