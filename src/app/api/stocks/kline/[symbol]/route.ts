import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import { getStockService } from '@/lib/services/stock-service';
import {
  createAPIError,
  createErrorResponse,
  createRateLimitResponse,
  createSuccessResponse,
  getStatusCodeForError,
  isAPIError
} from '@/lib/services/api-errors';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { DEFAULT_KLINE_INTERVAL, isKLineInterval } from '@/lib/types/stock-api';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit';

const CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/stocks/kline/[symbol]' },
    async (span) => {
      const requestPath = getRequestPath(request);

      try {
        const rateLimit = await enforceKLineRateLimit(request, requestPath);
        if (rateLimit.response) {
          return rateLimit.response;
        }

        const { symbol: rawSymbol } = await params;
        const symbol = normalizeTicker(rawSymbol ?? '');

        span?.setAttribute('symbol', symbol);
        span?.setAttribute('path', requestPath);

        const validation = validateTicker(symbol);
        if (!validation.isValid) {
          const error = createAPIError(
            'INVALID_SYMBOL',
            validation.error || 'Invalid ticker symbol'
          );

          logger.warn(`API Error: ${error.message}`, {
            symbol: rawSymbol,
            code: error.code,
            path: requestPath
          });

          return createErrorResponse(error, 400);
        }

        const url = new URL(request.url);
        const provider =
          url.searchParams.get('provider') || CANONICAL_QUOTE_PROVIDER;
        const rawInterval = url.searchParams.get('interval');
        const normalizedInterval = rawInterval?.toLowerCase();

        if (rawInterval && !isKLineInterval(normalizedInterval)) {
          const error = createAPIError(
            'INVALID_INTERVAL',
            `Unsupported kline interval: ${rawInterval}`
          );

          logger.warn(`API Error: ${error.message}`, {
            symbol,
            code: error.code,
            path: requestPath,
            interval: rawInterval
          });

          return createErrorResponse(error, 400);
        }

        const interval = isKLineInterval(normalizedInterval)
          ? normalizedInterval
          : DEFAULT_KLINE_INTERVAL;

        span?.setAttribute('provider', provider);
        span?.setAttribute('interval', interval);
        const stockService = getStockService();
        const series = await stockService.getKLineSeries(
          symbol,
          interval,
          provider
        );

        span?.setAttribute('kline.candles', series.candles.length);

        return createSuccessResponse(series, {
          ...rateLimit.headers,
          'Cache-Control': CACHE_HEADER
        });
      } catch (error) {
        Sentry.captureException(error);

        if (isAPIError(error)) {
          const statusCode = getStatusCodeForError(error.code);
          const logContext = {
            code: error.code,
            path: requestPath,
            originalError: error
          };

          if (statusCode >= 500) {
            logger.error(`API Error: ${error.message}`, logContext);
          } else {
            logger.warn(`API Warning: ${error.message}`, logContext);
          }

          return createErrorResponse(error);
        }

        logger.error('API Unexpected Error', {
          path: requestPath,
          error
        });

        return createErrorResponse(
          {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred'
          },
          500
        );
      }
    }
  );
}

async function enforceKLineRateLimit(request: NextRequest, path: string) {
  try {
    const result = await checkRateLimit(request, 'kline');
    const headers = createRateLimitHeaders(result);

    if (!result.allowed) {
      return {
        response: createRateLimitResponse(result.retryAfter, headers),
        headers
      };
    }

    return { headers };
  } catch (error) {
    logger.error('K-line API rate limiter unavailable', { error, path });

    return {
      response: createErrorResponse(
        createAPIError(
          'RATE_LIMIT_UNAVAILABLE',
          'Rate limit service unavailable'
        ),
        503
      ),
      headers: {}
    };
  }
}

function getRequestPath(request: NextRequest): string {
  if (request?.nextUrl?.pathname) {
    return request.nextUrl.pathname;
  }

  if (typeof request?.url === 'string') {
    try {
      return new URL(request.url).pathname;
    } catch {
      return 'unknown';
    }
  }

  return 'unknown';
}
