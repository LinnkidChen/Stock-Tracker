'use client';

import { useQuery } from '@tanstack/react-query';
import { APIResponse, StockQuote } from '@/lib/types/stock-api';
import { useDashboardStore } from '../store';

async function fetchStockQuote(
  symbol: string,
  provider: string
): Promise<StockQuote> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const searchParams = new URLSearchParams();
    if (provider) {
      searchParams.set('provider', provider);
    }

    const response = await fetch(
      `/api/stocks/quote/${symbol}?${searchParams.toString()}`,
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

export function useStockQuote(symbol?: string) {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);

  return useQuery({
    queryKey: ['stock-quote', symbol, quoteProvider],
    queryFn: () => fetchStockQuote(symbol!, quoteProvider),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes to respect API rate limits
    refetchInterval: false as const, // Disabled auto-refresh to prevent rate limit issues
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}
