import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';
import { logger } from '@/lib/logger';
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

const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
const WATCHLIST_AUTH_MISCONFIGURED_MESSAGE =
  'Watchlist authentication is not configured on the server.';
const WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION =
  'Configure Clerk JWT template "supabase" and configure Supabase JWT verification for Clerk-issued tokens.';

function createWatchlistAuthMisconfiguredResponse() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: WATCHLIST_AUTH_MISCONFIGURED_CODE,
        message: WATCHLIST_AUTH_MISCONFIGURED_MESSAGE
      }
    },
    { status: 503 }
  );
}

function handleWatchlistAuthMisconfiguration(message: string, error: unknown) {
  logger.error(message, {
    error,
    remediation: WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION
  });

  return createWatchlistAuthMisconfiguredResponse();
}

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

function createValidationError(message: string) {
  return NextResponse.json(
    { success: false, error: { message } },
    { status: 400 }
  );
}

async function enforceWatchlistRateLimit(req: Request, userId: string | null) {
  try {
    const result = await checkRateLimit(req, 'watchlist', {
      subject: userId
    });

    if (!result.allowed) {
      return createWatchlistRateLimitResponse(result);
    }

    return null;
  } catch (error) {
    logger.error('Watchlist rate limiter unavailable', { error });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Rate limit service unavailable'
        }
      },
      { status: 503 }
    );
  }
}

function createWatchlistRateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'API_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Try again later.',
        details: result.retryAfter
          ? { retryAfter: result.retryAfter }
          : undefined
      }
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result)
    }
  );
}

export async function GET(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  try {
    const items = await getWatchlistItems(userId);
    return createWatchlistResponse(items);
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist fetch unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist fetch error', { error });
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch watchlist' } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  let body: WatchlistRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const action = body.action;
  const symbol = body.symbol ? normalizeTicker(body.symbol) : undefined;

  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json(
      {
        success: false,
        error: { message: "'action' must be 'add' or 'remove'" }
      },
      { status: 400 }
    );
  }
  if (!symbol || !isValidTicker(symbol)) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid ticker symbol' } },
      { status: 400 }
    );
  }

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
          error instanceof Error ? error.message : 'Invalid metadata'
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
        error
      );
    }

    logger.error('Watchlist update error', { error });
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update watchlist' } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  let body: WatchlistPatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  try {
    if (body.action === 'update') {
      const symbol = body.symbol ? normalizeTicker(body.symbol) : undefined;
      if (!symbol || !isValidTicker(symbol)) {
        return createValidationError('Invalid ticker symbol');
      }

      let exchange: string | null;
      let note: string | null;

      try {
        exchange = normalizeExchange(body.exchange);
        note = normalizeNote(body.note);
      } catch (error) {
        return createValidationError(
          error instanceof Error ? error.message : 'Invalid metadata'
        );
      }

      const items = await updateWatchlistItemMetadata(userId, symbol, {
        exchange,
        note
      });

      return createWatchlistResponse(items);
    }

    if (body.action === 'reorder') {
      if (!Array.isArray(body.items)) {
        return createValidationError("'items' must be an array");
      }

      const seen = new Set<string>();
      const reorderItems: Array<{ symbol: string; sort_order: number }> = [];

      for (const item of body.items) {
        const symbol = item.symbol ? normalizeTicker(item.symbol) : undefined;
        const sortOrder = item.sort_order;

        if (!symbol || !isValidTicker(symbol)) {
          return createValidationError('Invalid ticker symbol');
        }

        if (
          typeof sortOrder !== 'number' ||
          !Number.isSafeInteger(sortOrder) ||
          sortOrder < 0
        ) {
          return createValidationError(
            'sort_order must be a non-negative safe integer'
          );
        }

        if (seen.has(symbol)) {
          return createValidationError('Duplicate reorder symbol');
        }

        seen.add(symbol);
        reorderItems.push({ symbol, sort_order: sortOrder });
      }

      const items = await reorderWatchlistItems(userId, reorderItems);
      return createWatchlistResponse(items);
    }

    return createValidationError("'action' must be 'update' or 'reorder'");
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist patch unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist patch error', { error });
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update watchlist' } },
      { status: 500 }
    );
  }
}
