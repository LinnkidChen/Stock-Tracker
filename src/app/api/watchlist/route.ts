import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';
import { logger } from '@/lib/logger';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
} from '@/lib/watchlist/storage';

/**
 * Action types for watchlist operations
 */
export type WatchlistAction = 'add' | 'remove';

/**
 * Request body structure for watchlist operations
 */
export interface WatchlistRequestBody {
  action?: WatchlistAction;
  symbol?: string;
}

/**
 * Response structure for successful watchlist operations
 */
export interface WatchlistResponse {
  success: true;
  data: {
    watchlist: string[];
  };
}

/**
 * Response structure for failed watchlist operations
 */
export interface WatchlistErrorResponse {
  success: false;
  error: {
    message: string;
  };
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
    const list = await getWatchlist(userId);
    return NextResponse.json({
      success: true,
      data: { watchlist: list }
    });
  } catch (error) {
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
    let list: string[];
    if (action === 'add') {
      list = await addToWatchlist(userId, symbol);
    } else {
      list = await removeFromWatchlist(userId, symbol);
    }

    return NextResponse.json({
      success: true,
      data: { watchlist: list }
    });
  } catch (error) {
    logger.error('Watchlist update error', { error });
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update watchlist' } },
      { status: 500 }
    );
  }
}
