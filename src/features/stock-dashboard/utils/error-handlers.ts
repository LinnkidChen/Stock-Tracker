import { ApiError } from '@/types/stocks';

export interface StockFetchError extends Error {
  code?: string;
  statusCode?: number;
  symbol?: string;
}

/**
 * Handles stock fetch errors and returns user-friendly messages
 */
export function handleStockFetchError(error: unknown, symbol?: string): string {
  if (error instanceof Error) {
    // Network or fetch errors
    if (error.name === 'AbortError') {
      return `Request timeout for ${symbol || 'stock'}`;
    }

    if (error.message.includes('fetch')) {
      return 'Network error - please check your connection';
    }

    // API errors with status codes
    if (error.message.includes('404')) {
      return `Symbol ${symbol || 'not found'}`;
    }

    if (error.message.includes('429')) {
      return 'Rate limit exceeded - please wait a moment';
    }

    if (error.message.includes('500')) {
      return 'Server error - please try again later';
    }

    // Return the original message if it's user-friendly
    if (error.message && !error.message.includes('Failed to fetch')) {
      return error.message;
    }
  }

  return `Failed to load data${symbol ? ` for ${symbol}` : ''}`;
}

/**
 * Detects if an error is due to API rate limiting
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('429') ||
      error.message.includes('rate limit') ||
      error.message.includes('Rate limit') ||
      error.message.includes('too many requests')
    );
  }

  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    return (
      apiError.code === 'RATE_LIMIT_EXCEEDED' ||
      apiError.message?.includes('rate limit') ||
      false
    );
  }

  return false;
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(error: unknown, context?: string): string {
  const baseMessage = handleStockFetchError(error);

  if (context) {
    return `${context}: ${baseMessage}`;
  }

  return baseMessage;
}

/**
 * Determines if an error should be retried automatically
 */
export function shouldRetryError(
  error: unknown,
  attemptCount: number = 0
): boolean {
  const maxRetries = 3;

  if (attemptCount >= maxRetries) {
    return false;
  }

  if (error instanceof Error) {
    // Don't retry client errors (4xx)
    if (error.message.includes('404') || error.message.includes('400')) {
      return false;
    }

    // Don't retry rate limits immediately
    if (isRateLimitError(error)) {
      return false;
    }

    // Retry network and server errors
    if (
      error.message.includes('fetch') ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503')
    ) {
      return true;
    }
  }

  return false;
}
