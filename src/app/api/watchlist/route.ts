import { NextResponse } from 'next/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';

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

/**
 * Combined response type for watchlist API
 */
export type WatchlistApiResponse = WatchlistResponse | WatchlistErrorResponse;

type Body = WatchlistRequestBody;

// Very simple in-memory stores keyed by client id (ip header)
const watchlists = new Map<string, Set<string>>();
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

/**
 * Handles POST requests for watchlist operations (add/remove symbols)
 *
 * @param req - The incoming request
 * @returns Response with updated watchlist or error
 */
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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const action: WatchlistAction | undefined = body.action;
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

  const list = watchlists.get(id) ?? new Set<string>();
  if (action === 'add') list.add(symbol);
  if (action === 'remove') list.delete(symbol);
  watchlists.set(id, list);

  return NextResponse.json({
    success: true,
    data: { watchlist: Array.from(list) }
  });
}
