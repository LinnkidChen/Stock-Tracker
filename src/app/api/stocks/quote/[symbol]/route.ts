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
import { createObservedError } from '@/lib/observability/error-taxonomy';
import {
  createObservedErrorResponse,
  reportApiError,
  reportObservedError
} from '@/lib/observability/route-errors';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/stocks/quote/[symbol]' },
    async (span) => {
      const requestPath = getRequestPath(request);
      let provider: string = CANONICAL_QUOTE_PROVIDER;
      let symbol = 'unknown';

      try {
        const rateLimit = await enforceQuoteRateLimit(request, requestPath);
        if (rateLimit.response) {
          return rateLimit.response;
        }

        const { symbol: rawSymbol } = await params;
        symbol = normalizeTicker(rawSymbol);

        span?.setAttribute('symbol', symbol);
        span?.setAttribute('path', requestPath);

        // Validate the ticker symbol
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
              operation: 'stock.quote',
              errorDomain: 'stock-data'
            }
          });

          return createErrorResponse(error, 400);
        }

        // Get the stock quote
        const url = new URL(request.url);
        provider = url.searchParams.get('provider') || CANONICAL_QUOTE_PROVIDER;
        span?.setAttribute('provider', provider);
        const stockService = getStockService();
        const quote = await stockService.getQuote(symbol, provider);

        return createSuccessResponse(quote, {
          ...rateLimit.headers,
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
        });
      } catch (error) {
        // Handle APIError
        if (isAPIError(error)) {
          // Log based on severity (client error vs server error)
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
              operation: 'stock.quote',
              errorDomain: 'stock-data'
            }
          );

          return createErrorResponse(error);
        }

        // Handle unexpected errors
        reportObservedError({
          code: 'UNKNOWN_ERROR',
          message: 'API Unexpected Error',
          error,
          span,
          context: {
            path: requestPath,
            provider,
            symbol,
            operation: 'stock.quote',
            errorDomain: 'stock-data'
          }
        });

        return createObservedErrorResponse({ code: 'UNKNOWN_ERROR' });
      }
    }
  );
}

async function enforceQuoteRateLimit(request: NextRequest, path: string) {
  try {
    const result = await checkRateLimit(request, 'quote');
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
      message: 'Quote API rate limiter unavailable',
      error,
      context: {
        path,
        operation: 'stock.quote',
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
