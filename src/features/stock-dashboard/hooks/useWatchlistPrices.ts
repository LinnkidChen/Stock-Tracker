'use client';

import { useQueries } from '@tanstack/react-query';
import { StockQuote } from '@/lib/types/stock-api';
import { WatchlistPricesMap } from '@/types/stocks';
import { useDashboardStore } from '../store';
import {
  isLongbridgeCredentialError,
  readStockApiResponse
} from '../lib/stock-api-error';

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
  hasErrors: boolean;
  errorSymbols: string[];
  refetch: () => void;
}

export function useWatchlistPrices(
  symbols: string[]
): UseWatchlistPricesResult {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));

  const results = useQueries({
    queries: uniqueSymbols.map((symbol) => ({
      queryKey: ['stock-quote', symbol, quoteProvider],
      queryFn: () => fetchStockQuote(symbol, quoteProvider),
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: false as const,
      retry: (failureCount: number, error: Error) =>
        !isLongbridgeCredentialError(error) && failureCount < 3,
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
