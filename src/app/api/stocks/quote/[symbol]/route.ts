import { NextRequest, NextResponse } from 'next/server';
import { getStockService } from '@/lib/services/stock-service';
import { validateTicker } from '@/lib/validation/ticker';
import { APIResponse, StockQuote, APIError } from '@/lib/types/stock-api';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol;

    // Validate the ticker symbol
    const validation = validateTicker(symbol);
    if (!validation.isValid) {
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: {
          code: 'INVALID_SYMBOL',
          message: validation.error || 'Invalid ticker symbol'
        },
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
      const response: APIResponse<null> = {
        success: false,
        data: null,
        error: error,
        timestamp: new Date().toISOString()
      };

      // Map error codes to HTTP status codes
      const statusCode = getStatusCodeForError(error.code);
      return NextResponse.json(response, { status: statusCode });
    }

    // Handle unexpected errors
    // TODO: Replace with proper logging service in production
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
