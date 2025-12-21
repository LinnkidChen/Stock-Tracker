import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import { APIResponse, KLineSeries, APIError } from '@/lib/types/stock-api';
import { logger } from '@/lib/logger';

const CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/stocks/kline/[symbol]' },
    async (span) => {
      const requestPath = request?.nextUrl?.pathname ?? 'unknown';

      try {
        const { symbol: rawSymbol } = await params;
        const symbol = normalizeTicker(rawSymbol ?? '');

        span?.setAttribute('symbol', symbol);
        span?.setAttribute('path', requestPath);

        const validation = validateTicker(symbol);
        if (!validation.isValid) {
          const error: APIError = {
            code: 'INVALID_SYMBOL',
            message: validation.error || 'Invalid ticker symbol'
          };

          logger.warn(`API Error: ${error.message}`, {
            symbol: rawSymbol,
            code: error.code,
            path: requestPath
          });

          const response: APIResponse<null> = {
            success: false,
            data: null,
            error,
            timestamp: new Date().toISOString()
          };

          return NextResponse.json(response, { status: 400 });
        }

        const stockService = getStockService();
        const series = await stockService.getKLineSeries(symbol);

        span?.setAttribute('kline.candles', series.candles.length);

        const response: APIResponse<KLineSeries> = {
          success: true,
          data: series,
          error: null,
          timestamp: new Date().toISOString()
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            'Cache-Control': CACHE_HEADER
          }
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

          const response: APIResponse<null> = {
            success: false,
            data: null,
            error,
            timestamp: new Date().toISOString()
          };

          return NextResponse.json(response, { status: statusCode });
        }

        logger.error('API Unexpected Error', {
          path: requestPath,
          error
        });

        const response: APIResponse<null> = {
          success: false,
          data: null,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred'
          },
          timestamp: new Date().toISOString()
        };

        return NextResponse.json(response, { status: 500 });
      }
    }
  );
}

function isAPIError(error: unknown): error is APIError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  );
}

function getStatusCodeForError(code: string): number {
  switch (code) {
    case 'INVALID_SYMBOL':
      return 400;
    case 'API_LIMIT_EXCEEDED':
      return 429;
    case 'INVALID_API_KEY':
      return 401;
    case 'NETWORK_ERROR':
      return 502;
    case 'UNKNOWN_ERROR':
    default:
      return 500;
  }
}
