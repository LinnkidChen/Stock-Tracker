import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import {
  AUTO_QUOTE_PROVIDER,
  CANONICAL_QUOTE_PROVIDER
} from '@/lib/providers/config';
import { StockProviderFactory } from '@/lib/providers/factory';
import {
  createErrorResponse,
  createSuccessResponse,
  getStatusCodeForError,
  isAPIError
} from '@/lib/services/api-errors';
import { isObservedErrorCode } from '@/lib/observability/error-taxonomy';
import {
  createObservedErrorResponse,
  reportApiError,
  reportObservedError
} from '@/lib/observability/route-errors';

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
        const health =
          providerName === AUTO_QUOTE_PROVIDER || providerName === 'all'
            ? await StockProviderFactory.getProviderHealthReport()
            : await StockProviderFactory.getProvider(
                providerName
              ).healthCheck();

        span?.setAttribute('provider.status', health.status);

        if (health.status !== 'healthy') {
          const detailCode = 'details' in health ? health.details?.code : null;
          const code = isObservedErrorCode(detailCode)
            ? detailCode
            : 'PROVIDER_FAILURE';

          reportObservedError({
            code,
            message: `Provider health ${health.status}: ${providerName}`,
            span,
            context: {
              path: requestPath,
              provider: providerName,
              providerStatus: health.status,
              operation: 'provider.health',
              errorDomain: 'stock-data'
            }
          });
        }

        return createSuccessResponse(health, {
          'Cache-Control': 'no-store'
        });
      } catch (error) {
        if (isAPIError(error)) {
          const statusCode = getStatusCodeForError(error.code);
          reportApiError(
            error,
            statusCode >= 500
              ? `Provider health API Error: ${error.message}`
              : `Provider health API Warning: ${error.message}`,
            span,
            {
              path: requestPath,
              provider: providerName,
              operation: 'provider.health',
              errorDomain: 'stock-data'
            }
          );

          return createErrorResponse(error);
        }

        reportObservedError({
          code: 'UNKNOWN_ERROR',
          message: 'Provider health API Unexpected Error',
          error,
          span,
          context: {
            path: requestPath,
            provider: providerName,
            operation: 'provider.health',
            errorDomain: 'stock-data'
          }
        });

        return createObservedErrorResponse({ code: 'UNKNOWN_ERROR' });
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
