import { NextResponse } from 'next/server';
import { APIResponse, APIError, APIErrorCode } from '../types/stock-api';
import {
  getErrorStatusCode,
  isObservedErrorCode,
  toDashboardError
} from '@/lib/observability/error-taxonomy';

/**
 * Create a standardized error response
 */
export function createErrorResponse<T = null>(
  error: APIError,
  statusCode?: number,
  headers?: HeadersInit
): NextResponse<APIResponse<T>> {
  const responseError = toDashboardError(error);
  const response: APIResponse<T> = {
    success: false,
    data: null as T,
    error: responseError,
    timestamp: new Date().toISOString()
  };

  const status = statusCode || getStatusCodeForError(error.code);
  const retryAfter = getRetryAfterFromError(error);
  const responseHeaders = new Headers(headers);
  if (retryAfter) {
    responseHeaders.set('Retry-After', String(retryAfter));
  }

  return NextResponse.json(response, { status, headers: responseHeaders });
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
  return getErrorStatusCode(code);
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
    isObservedErrorCode((error as Record<string, unknown>).code) &&
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
  retryAfter?: number,
  headers?: HeadersInit
): NextResponse<APIResponse<null>> {
  // Validate and cap retry time to reasonable limits (max 5 minutes)
  const validRetryAfter = getValidRetryAfter(retryAfter);
  const error = createAPIError(
    'API_LIMIT_EXCEEDED',
    'Rate limit exceeded. Please try again later.',
    validRetryAfter ? { retryAfter: validRetryAfter } : undefined
  );

  return createErrorResponse(error, 429, headers);
}

export function getRetryAfterFromError(error: APIError): number | undefined {
  return getValidRetryAfter(error.details?.retryAfter);
}

function getValidRetryAfter(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value <= 300 ? Math.ceil(value) : undefined;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (
      Number.isFinite(numericValue) &&
      numericValue > 0 &&
      numericValue <= 300
    ) {
      return Math.ceil(numericValue);
    }
  }

  return undefined;
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
