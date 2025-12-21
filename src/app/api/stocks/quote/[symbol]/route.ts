import { NextRequest, NextResponse } from 'next/server';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker, normalizeTicker } from '@/lib/validation/ticker';
import {
  APIResponse,
  StockQuote,
  APIError,
  APIErrorCode
} from '@/lib/types/stock-api';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const requestPath = getRequestPath(request);

  try {
    const { symbol: rawSymbol } = await params;
    const symbol = normalizeTicker(rawSymbol);

    // Validate the ticker symbol
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

    // Get the stock quote
    const stockService = getStockService();
    const quote = await stockService.getQuote(symbol);

    // Return successful response
    const response: APIResponse<StockQuote> = {
      success: true,
      data: quote,
      error: null,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    // Handle APIError
    if (isAPIError(error)) {
      // Log based on severity (client error vs server error)
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
        error: error,
        timestamp: new Date().toISOString()
      };

      return NextResponse.json(response, { status: statusCode });
    }

    // Handle unexpected errors
    const sanitizedError = sanitizeError(error);
    logger.error('API Unexpected Error', {
      path: requestPath,
      error: sanitizedError
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

function sanitizeError(error: unknown): unknown {
  if (typeof error === 'string') {
    return error.replace(/(api_key|token|key)=[^&"\s]+/gi, '$1=***');
  }
  if (error && typeof error === 'object') {
    // Simple deep copy and sanitize strings is expensive,
    // so we'll just sanitize the message and string representation for now
    // or return a safe object structure.
    const err = error as Record<string, unknown>;
    const message =
      typeof err.message === 'string'
        ? err.message.replace(/(api_key|token|key)=[^&"\s]+/gi, '$1=***')
        : 'Unknown error';

    // Return a safe subset structure
    return {
      ...err,
      message
    };
  }
  return error;
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
