import { NextResponse } from 'next/server';
import { APIResponse, APIError, APIErrorCode } from '../types/stock-api';

/**
 * Create a standardized error response
 */
export function createErrorResponse<T = null>(
  error: APIError,
  statusCode?: number
): NextResponse<APIResponse<T>> {
  const response: APIResponse<T> = {
    success: false,
    data: null as T,
    error,
    timestamp: new Date().toISOString()
  };

  const status = statusCode || getStatusCodeForError(error.code);

  return NextResponse.json(response, { status });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  headers?: HeadersInit
): NextResponse<APIResponse<T>> {
  const response: APIResponse<T> = {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response, {
    status: 200,
    headers
  });
}

/**
 * Map error codes to HTTP status codes
 */
export function getStatusCodeForError(code: APIErrorCode): number {
  const statusMap: Record<APIErrorCode, number> = {
    INVALID_SYMBOL: 400,
    API_LIMIT_EXCEEDED: 429,
    INVALID_API_KEY: 401,
    NETWORK_ERROR: 502,
    UNKNOWN_ERROR: 500
  };

  return statusMap[code] || 500;
}

/**
 * Create an APIError object
 */
export function createAPIError(
  code: APIErrorCode,
  message: string,
  details?: Record<string, unknown>
): APIError {
  return {
    code,
    message,
    details
  };
}

/**
 * Type guard to check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Wrap an unknown error into an APIError
 */
export function wrapError(
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): APIError {
  if (isAPIError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    return createAPIError(
      'UNKNOWN_ERROR',
      error.message || defaultMessage,
      isDevelopment ? { name: error.name, stack: error.stack } : undefined
    );
  }

  return createAPIError(
    'UNKNOWN_ERROR',
    defaultMessage,
    process.env.NODE_ENV === 'development'
      ? { originalError: error }
      : undefined
  );
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(
  retryAfter?: number
): NextResponse<APIResponse<null>> {
  // Validate and cap retry time to reasonable limits (max 5 minutes)
  const validRetryAfter =
    retryAfter && retryAfter > 0 && retryAfter <= 300 ? retryAfter : undefined;
  const error = createAPIError(
    'API_LIMIT_EXCEEDED',
    'Rate limit exceeded. Please try again later.',
    validRetryAfter ? { retryAfter: validRetryAfter } : undefined
  );

  const headers: HeadersInit = validRetryAfter
    ? { 'Retry-After': String(validRetryAfter) }
    : {};

  return NextResponse.json(
    {
      success: false,
      data: null,
      error,
      timestamp: new Date().toISOString()
    },
    {
      status: 429,
      headers
    }
  );
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  field: string,
  message: string
): NextResponse<APIResponse<null>> {
  const error = createAPIError('INVALID_SYMBOL', message, { field });

  return createErrorResponse(error, 400);
}
