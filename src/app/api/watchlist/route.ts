import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';
import { logger } from '@/lib/logger';
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
export type WatchlistAction = 'add' | 'remove';
export type WatchlistPatchAction = 'update' | 'reorder';

/**
 * Request body structure for watchlist operations
 */
export interface WatchlistRequestBody {
  action?: WatchlistAction;
  symbol?: string;
  exchange?: unknown;
  note?: unknown;
}

export interface WatchlistPatchRequestBody {
  action?: WatchlistPatchAction;
  symbol?: string;
  exchange?: unknown;
  note?: unknown;
  items?: Array<{
    symbol?: string;
    sort_order?: unknown;
  }>;
}

/**
 * Response structure for successful watchlist operations
 */
export interface WatchlistResponse {
  success: true;
  data: {
    watchlist: string[];
    items: WatchlistItem[];
  };
}

/**
 * Response structure for failed watchlist operations
 */
export interface WatchlistErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

export const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
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

// Very simple in-memory stores keyed by client id (ip header) for rate limiting
const rateBuckets = new Map<string, { count: number; reset: number }>();

/**
 * Extracts client identifier from request headers for rate limiting
 */
function getClientId(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  return ip || 'anonymous';
}

/**
 * Implements simple rate limiting per client
 */
function rateLimit(id: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const bucket = rateBuckets.get(id);
  if (!bucket || now > bucket.reset) {
    rateBuckets.set(id, { count: 1, reset: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.reset - now) / 1000)
    };
  }
  bucket.count++;
  return { allowed: true };
}

export async function GET() {
  const { userId } = await auth();
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
  const id = getClientId(req);
  const rl = rateLimit(id);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Rate limit exceeded. Try again later.' }
      },
      {
        status: 429,
        headers: rl.retryAfter
          ? { 'Retry-After': String(rl.retryAfter) }
          : undefined
      }
    );
  }

  const { userId } = await auth();
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
  const id = getClientId(req);
  const rl = rateLimit(id);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Rate limit exceeded. Try again later.' }
      },
      {
        status: 429,
        headers: rl.retryAfter
          ? { 'Retry-After': String(rl.retryAfter) }
          : undefined
      }
    );
  }

  const { userId } = await auth();
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
