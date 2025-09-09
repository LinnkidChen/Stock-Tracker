'use client';

import { useQuery } from '@tanstack/react-query';
import { APIResponse, StockQuote } from '@/lib/types/stock-api';

async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

export function useStockQuote(symbol?: string) {
  return useQuery({
    queryKey: ['stock-quote', symbol],
    queryFn: () => fetchStockQuote(symbol!),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes to respect API rate limits
    refetchInterval: false as const, // Disabled auto-refresh to prevent rate limit issues
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}
