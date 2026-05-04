import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import { getOptionalRateLimitUserId } from '@/lib/rate-limit-auth';
import { StockProviderFactory } from '@/lib/providers/factory';
import {
  createErrorResponse,
  createSuccessResponse,
  getStatusCodeForError,
  isAPIError
} from '@/lib/services/api-errors';
import {
  consumeStockReadRateLimit,
  recordRateLimitTelemetry,
  toRateLimitError
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/stocks/providers/health' },
    async (span) => {
      const requestPath = getRequestPath(request);
      const providerName =
        request.nextUrl?.searchParams.get('provider') ||
        CANONICAL_QUOTE_PROVIDER;

      span?.setAttribute('provider', providerName);
      span?.setAttribute('path', requestPath);

      try {
        const rateLimitUserId = await getOptionalRateLimitUserId(requestPath);
        const rateLimit = await consumeStockReadRateLimit(
          request,
          rateLimitUserId
        );
        recordRateLimitTelemetry(span, rateLimit);

        if (!rateLimit.allowed) {
          return createErrorResponse(
            rateLimit.error ?? toRateLimitError(rateLimit),
            429,
            rateLimit.headers
          );
        }

        const provider = StockProviderFactory.getProvider(providerName);
        const health = await provider.healthCheck();

        span?.setAttribute('provider.status', health.status);

        return createSuccessResponse(health, {
          'Cache-Control': 'no-store'
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
            logger.error(
              `Provider health API Error: ${error.message}`,
              logContext
            );
          } else {
            logger.warn(
              `Provider health API Warning: ${error.message}`,
              logContext
            );
          }

          return createErrorResponse(error);
        }

        logger.error('Provider health API Unexpected Error', {
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
