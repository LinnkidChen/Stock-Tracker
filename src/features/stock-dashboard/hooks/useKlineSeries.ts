'use client';

import { useQuery } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { APIResponse, KLineSeries } from '@/lib/types/stock-api';

async function fetchKlineSeries(symbol: string): Promise<KLineSeries> {
  return Sentry.startSpan(
    { op: 'http.client', name: `GET /api/stocks/kline/${symbol}` },
    async (span) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`/api/stocks/kline/${symbol}`, {
          signal: controller.signal
        });

        span?.setAttribute('http.status', response.status);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch kline series: ${response.statusText}`
          );
        }

        const apiResponse: APIResponse<KLineSeries> = await response.json();

        if (!apiResponse.success || !apiResponse.data) {
          throw new Error(
            apiResponse.error?.message || 'Failed to fetch kline data'
          );
        }

        span?.setAttribute('kline.candles', apiResponse.data.candles.length);

        return apiResponse.data;
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}

export function useKlineSeries(symbol?: string) {
  const query = useQuery({
    queryKey: ['kline-series', symbol],
    queryFn: () => fetchKlineSeries(symbol!),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: false as const,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const noData =
    !!symbol &&
    !query.isLoading &&
    !query.isError &&
    (query.data?.candles.length ?? 0) === 0;

  return { ...query, noData };
}
