import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';
import {
  checkRateLimit,
  createRateLimitHeaders,
  type RateLimitResult
} from '@/lib/rate-limit';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  getWatchlistItems,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistItemMetadata,
  reorderWatchlistItems
} from '@/lib/watchlist/storage';
import type { WatchlistItem } from '@/types/watchlist';
import {
  reportAndCreateObservedErrorResponse,
  toPersistenceErrorCode
} from '@/lib/observability/route-errors';
import type { TelemetrySpan } from '@/lib/observability/error-taxonomy';
import type { APIErrorCode } from '@/lib/types/stock-api';

/**
 * Action types for watchlist operations
 */
type WatchlistAction = 'add' | 'remove';
type WatchlistPatchAction = 'update' | 'reorder';

/**
 * Request body structure for watchlist operations
 */
interface WatchlistRequestBody {
  action?: WatchlistAction;
  symbol?: string;
  exchange?: unknown;
  note?: unknown;
}

interface WatchlistPatchRequestBody {
  action?: WatchlistPatchAction;
  symbol?: string;
  exchange?: unknown;
  note?: unknown;
  items?: Array<{
    symbol?: string;
    sort_order?: unknown;
  }>;
}

const WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION =
  'Configure Clerk JWT template "supabase" and configure Supabase JWT verification for Clerk-issued tokens.';

function createWatchlistResponse(items: WatchlistItem[]) {
  return NextResponse.json({
    success: true,
    data: {
      watchlist: items.map((item) => item.symbol),
      items
    }
  });
}

function normalizeExchange(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Exchange must be a string');
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Note must be a string');
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new Error('Note must be 500 characters or less');
  }

  return trimmed;
}

function createWatchlistError(
  code: APIErrorCode,
  message: string,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown> = {},
  error?: unknown,
  details?: Record<string, unknown>,
  headers?: HeadersInit
) {
  return reportAndCreateObservedErrorResponse({
    code,
    message,
    error,
    details,
    headers,
    span,
    context: {
      errorDomain: 'watchlist',
      ...context
    }
  });
}

function createValidationError(
  message: string,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown> = {}
) {
  return createWatchlistError('VALIDATION_ERROR', message, span, context);
}

function createInvalidSymbolError(
  message: string,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown> = {}
) {
  return createWatchlistError('INVALID_SYMBOL', message, span, context);
}

function createUnauthenticatedError(
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return reportAndCreateObservedErrorResponse({
    code: 'AUTH_UNAUTHENTICATED',
    message: 'Unauthorized',
    span,
    context: {
      errorDomain: 'auth',
      ...context
    }
  });
}

function handleWatchlistAuthMisconfiguration(
  message: string,
  error: unknown,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createWatchlistError(
    'RLS_AUTH_MISCONFIGURED',
    message,
    span,
    {
      remediation: WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION,
      ...context
    },
    error
  );
}

function handleWatchlistPersistenceError(
  message: string,
  error: unknown,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createWatchlistError(
    toPersistenceErrorCode(error),
    message,
    span,
    context,
    error
  );
}

async function enforceWatchlistRateLimit(
  req: Request,
  userId: string | null,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  try {
    const result = await checkRateLimit(req, 'watchlist', {
      subject: userId
    });

    if (!result.allowed) {
      return createWatchlistRateLimitResponse(result, span, context);
    }

    return null;
  } catch (error) {
    return createWatchlistError(
      'RATE_LIMIT_UNAVAILABLE',
      'Rate limit service unavailable',
      span,
      context,
      error
    );
  }
}

function createWatchlistRateLimitResponse(
  result: RateLimitResult,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createWatchlistError(
    'API_LIMIT_EXCEEDED',
    'Rate limit exceeded. Try again later.',
    span,
    {
      ...context,
      rateLimitSource: result.source
    },
    undefined,
    result.retryAfter ? { retryAfter: result.retryAfter } : undefined,
    createRateLimitHeaders(result)
  );
}

export async function GET(req: Request) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/watchlist' },
    async (span) => {
      const path = '/api/watchlist';
      span?.setAttribute?.('path', path);

      const { userId } = await auth();
      const rateLimitResponse = await enforceWatchlistRateLimit(
        req,
        userId,
        span,
        {
          path,
          operation: 'watchlist.fetch'
        }
      );
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      if (!userId) {
        return createUnauthenticatedError(span, {
          path,
          operation: 'watchlist.fetch'
        });
      }

      try {
        const items = await getWatchlistItems(userId);
        span?.setAttribute?.('watchlist.items_count', items.length);
        return createWatchlistResponse(items);
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handleWatchlistAuthMisconfiguration(
            'Watchlist fetch unavailable due to auth misconfiguration',
            error,
            span,
            { path, operation: 'watchlist.fetch' }
          );
        }

        return handleWatchlistPersistenceError(
          'Watchlist fetch error',
          error,
          span,
          {
            path,
            operation: 'watchlist.fetch'
          }
        );
      }
    }
  );
}

export async function POST(req: Request) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/watchlist' },
    async (span) => {
      const path = getRequestPath(req, '/api/watchlist');
      span?.setAttribute?.('path', path);

      const { userId } = await auth();
      const rateLimitResponse = await enforceWatchlistRateLimit(
        req,
        userId,
        span,
        {
          path,
          operation: 'watchlist.update'
        }
      );
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      if (!userId) {
        return createUnauthenticatedError(span, {
          path,
          operation: 'watchlist.update'
        });
      }

      let body: WatchlistRequestBody;
      try {
        body = await req.json();
      } catch {
        return createValidationError('Invalid JSON body', span, {
          path,
          operation: 'watchlist.update'
        });
      }

      const action = body.action;
      const symbol = body.symbol ? normalizeTicker(body.symbol) : undefined;

      if (action !== 'add' && action !== 'remove') {
        return createValidationError(
          "'action' must be 'add' or 'remove'",
          span,
          {
            path,
            operation: 'watchlist.update'
          }
        );
      }
      if (!symbol || !isValidTicker(symbol)) {
        return createInvalidSymbolError('Invalid ticker symbol', span, {
          path,
          operation: 'watchlist.update',
          symbol: body.symbol ?? 'missing'
        });
      }

      span?.setAttribute?.('watchlist.action', action);
      span?.setAttribute?.('watchlist.symbol', symbol);

      try {
        let items: WatchlistItem[];
        if (action === 'add') {
          let exchange: string | null;
          let note: string | null;

          try {
            exchange = normalizeExchange(body.exchange);
            note = normalizeNote(body.note);
          } catch (error) {
            return createValidationError(
              error instanceof Error ? error.message : 'Invalid metadata',
              span,
              {
                path,
                operation: 'watchlist.update',
                symbol
              }
            );
          }

          items = await addToWatchlist(userId, symbol, { exchange, note });
        } else {
          items = await removeFromWatchlist(userId, symbol);
        }

        return createWatchlistResponse(items);
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handleWatchlistAuthMisconfiguration(
            'Watchlist update unavailable due to auth misconfiguration',
            error,
            span,
            { path, operation: 'watchlist.update', symbol }
          );
        }

        return handleWatchlistPersistenceError(
          'Watchlist update error',
          error,
          span,
          {
            path,
            operation: 'watchlist.update',
            symbol
          }
        );
      }
    }
  );
}

export async function PATCH(req: Request) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'PATCH /api/watchlist' },
    async (span) => {
      const path = getRequestPath(req, '/api/watchlist');
      span?.setAttribute?.('path', path);

      const { userId } = await auth();
      const rateLimitResponse = await enforceWatchlistRateLimit(
        req,
        userId,
        span,
        {
          path,
          operation: 'watchlist.patch'
        }
      );
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      if (!userId) {
        return createUnauthenticatedError(span, {
          path,
          operation: 'watchlist.patch'
        });
      }

      let body: WatchlistPatchRequestBody;
      try {
        body = await req.json();
      } catch {
        return createValidationError('Invalid JSON body', span, {
          path,
          operation: 'watchlist.patch'
        });
      }

      try {
        if (body.action === 'update') {
          const symbol = body.symbol ? normalizeTicker(body.symbol) : undefined;
          if (!symbol || !isValidTicker(symbol)) {
            return createInvalidSymbolError('Invalid ticker symbol', span, {
              path,
              operation: 'watchlist.patch',
              symbol: body.symbol ?? 'missing'
            });
          }

          let exchange: string | null;
          let note: string | null;

          try {
            exchange = normalizeExchange(body.exchange);
            note = normalizeNote(body.note);
          } catch (error) {
            return createValidationError(
              error instanceof Error ? error.message : 'Invalid metadata',
              span,
              {
                path,
                operation: 'watchlist.patch',
                symbol
              }
            );
          }

          span?.setAttribute?.('watchlist.action', body.action);
          span?.setAttribute?.('watchlist.symbol', symbol);

          const items = await updateWatchlistItemMetadata(userId, symbol, {
            exchange,
            note
          });

          return createWatchlistResponse(items);
        }

        if (body.action === 'reorder') {
          if (!Array.isArray(body.items)) {
            return createValidationError("'items' must be an array", span, {
              path,
              operation: 'watchlist.patch'
            });
          }

          const seen = new Set<string>();
          const reorderItems: Array<{ symbol: string; sort_order: number }> =
            [];

          for (const item of body.items) {
            const symbol = item.symbol
              ? normalizeTicker(item.symbol)
              : undefined;
            const sortOrder = item.sort_order;

            if (!symbol || !isValidTicker(symbol)) {
              return createInvalidSymbolError('Invalid ticker symbol', span, {
                path,
                operation: 'watchlist.patch',
                symbol: item.symbol ?? 'missing'
              });
            }

            if (
              typeof sortOrder !== 'number' ||
              !Number.isSafeInteger(sortOrder) ||
              sortOrder < 0
            ) {
              return createValidationError(
                'sort_order must be a non-negative safe integer',
                span,
                {
                  path,
                  operation: 'watchlist.patch',
                  symbol
                }
              );
            }

            if (seen.has(symbol)) {
              return createValidationError('Duplicate reorder symbol', span, {
                path,
                operation: 'watchlist.patch',
                symbol
              });
            }

            seen.add(symbol);
            reorderItems.push({ symbol, sort_order: sortOrder });
          }

          span?.setAttribute?.('watchlist.action', body.action);
          span?.setAttribute?.('watchlist.reorder_count', reorderItems.length);

          const items = await reorderWatchlistItems(userId, reorderItems);
          return createWatchlistResponse(items);
        }

        return createValidationError(
          "'action' must be 'update' or 'reorder'",
          span,
          {
            path,
            operation: 'watchlist.patch'
          }
        );
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handleWatchlistAuthMisconfiguration(
            'Watchlist patch unavailable due to auth misconfiguration',
            error,
            span,
            { path, operation: 'watchlist.patch' }
          );
        }

        return handleWatchlistPersistenceError(
          'Watchlist patch error',
          error,
          span,
          {
            path,
            operation: 'watchlist.patch'
          }
        );
      }
    }
  );
}

function getRequestPath(req: Request, fallback: string): string {
  if (typeof req.url !== 'string') {
    return fallback;
  }

  try {
    return new URL(req.url).pathname;
  } catch {
    return fallback;
  }
}
