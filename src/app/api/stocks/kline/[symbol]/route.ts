import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import { getStockService } from '@/lib/services/stock-service';
import {
  createErrorResponse,
  createRateLimitResponse,
  createSuccessResponse,
  getStatusCodeForError,
  isAPIError
} from '@/lib/services/api-errors';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { DEFAULT_KLINE_INTERVAL, isKLineInterval } from '@/lib/types/stock-api';
import { createObservedError } from '@/lib/observability/error-taxonomy';
import {
  createObservedErrorResponse,
  reportApiError,
  reportObservedError
} from '@/lib/observability/route-errors';
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
      let provider: string = CANONICAL_QUOTE_PROVIDER;
      let symbol = 'unknown';
      let interval = DEFAULT_KLINE_INTERVAL;

      try {
        const rateLimit = await enforceKLineRateLimit(request, requestPath);
        if (rateLimit.response) {
          return rateLimit.response;
        }

        const { symbol: rawSymbol } = await params;
        symbol = normalizeTicker(rawSymbol ?? '');

        span?.setAttribute('symbol', symbol);
        span?.setAttribute('path', requestPath);

        const validation = validateTicker(symbol);
        if (!validation.isValid) {
          const error = createObservedError('INVALID_SYMBOL', {
            message: validation.error || 'Invalid ticker symbol'
          });

          reportObservedError({
            code: error.code,
            message: `API Validation Error: ${error.message}`,
            span,
            context: {
              symbol: rawSymbol,
              normalizedSymbol: symbol,
              path: requestPath,
              operation: 'stock.kline',
              errorDomain: 'stock-data'
            }
          });

          return createErrorResponse(error, 400);
        }

        const url = new URL(request.url);
        provider = url.searchParams.get('provider') || CANONICAL_QUOTE_PROVIDER;
        const rawInterval = url.searchParams.get('interval');
        const normalizedInterval = rawInterval?.toLowerCase();

        if (rawInterval && !isKLineInterval(normalizedInterval)) {
          const error = createObservedError('INVALID_INTERVAL', {
            message: `Unsupported kline interval: ${rawInterval}`
          });

          reportObservedError({
            code: error.code,
            message: `API Validation Error: ${error.message}`,
            span,
            context: {
              symbol,
              path: requestPath,
              provider,
              interval: rawInterval,
              operation: 'stock.kline',
              errorDomain: 'stock-data'
            }
          });

          return createErrorResponse(error, 400);
        }

        interval = isKLineInterval(normalizedInterval)
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
        if (isAPIError(error)) {
          const statusCode = getStatusCodeForError(error.code);
          reportApiError(
            error,
            statusCode >= 500
              ? `API Error: ${error.message}`
              : `API Warning: ${error.message}`,
            span,
            {
              path: requestPath,
              provider,
              symbol,
              interval,
              operation: 'stock.kline',
              errorDomain: 'stock-data'
            }
          );

          return createErrorResponse(error);
        }

        reportObservedError({
          code: 'UNKNOWN_ERROR',
          message: 'API Unexpected Error',
          error,
          span,
          context: {
            path: requestPath,
            provider,
            symbol,
            interval,
            operation: 'stock.kline',
            errorDomain: 'stock-data'
          }
        });

        return createObservedErrorResponse({ code: 'UNKNOWN_ERROR' });
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
    reportObservedError({
      code: 'RATE_LIMIT_UNAVAILABLE',
      message: 'K-line API rate limiter unavailable',
      error,
      context: {
        path,
        operation: 'stock.kline',
        errorDomain: 'stock-data'
      }
    });

    return {
      response: createObservedErrorResponse({
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Rate limit service unavailable',
        statusCode: 503
      }),
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
