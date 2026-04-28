'use client';

import { useQuery } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import {
  DEFAULT_KLINE_INTERVAL,
  type KLineInterval,
  KLineSeries
} from '@/lib/types/stock-api';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import {
  isLongbridgeCredentialError,
  readStockApiResponse
} from '../lib/stock-api-error';

async function fetchKlineSeries(
  symbol: string,
  interval: KLineInterval = DEFAULT_KLINE_INTERVAL,
  provider: string = CANONICAL_QUOTE_PROVIDER
): Promise<KLineSeries> {
  return Sentry.startSpan(
    { op: 'http.client', name: `GET /api/stocks/kline/${symbol}` },
    async (span) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const searchParams = new URLSearchParams({ provider, interval });
        const response = await fetch(
          `/api/stocks/kline/${symbol}?${searchParams.toString()}`,
          {
            signal: controller.signal
          }
        );

        span?.setAttribute('http.status', response.status);

        const series = await readStockApiResponse<KLineSeries>(
          response,
          `Failed to fetch kline series: ${response.statusText}`
        );

        span?.setAttribute('kline.candles', series.candles.length);

        return series;
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}

export function useKlineSeries(
  symbol?: string,
  interval: KLineInterval = DEFAULT_KLINE_INTERVAL,
  provider: string = CANONICAL_QUOTE_PROVIDER
) {
  const query = useQuery({
    queryKey: ['kline-series', symbol, provider, interval],
    queryFn: () => fetchKlineSeries(symbol!, interval, provider),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: false as const,
    retry: (failureCount, error) =>
      !isLongbridgeCredentialError(error) && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  const noData =
    !!symbol &&
    !query.isLoading &&
    !query.isError &&
    (query.data?.candles.length ?? 0) === 0;

  return { ...query, noData };
}
