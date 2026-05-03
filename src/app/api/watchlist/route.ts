import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  createRateLimitHeaders,
  type RateLimitResult
} from '@/lib/rate-limit';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  WATCHLIST_AUTH_MISCONFIGURED_CODE,
  WATCHLIST_AUTH_MISCONFIGURED_MESSAGE,
  WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION
} from '@/lib/watchlist/api-errors';
import {
  applyWatchlistMutation,
  applyWatchlistPatch,
  createWatchlistPayload,
  getWatchlistForUser
} from '@/lib/watchlist/service';
import {
  validateWatchlistMutationBody,
  validateWatchlistPatchBody
} from '@/lib/watchlist/validation';
import type { WatchlistItem } from '@/types/watchlist';

function createErrorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        ...(code ? { code } : {}),
        message
      }
    },
    { status }
  );
}

function createWatchlistResponse(items: WatchlistItem[]) {
  return NextResponse.json({
    success: true,
    data: createWatchlistPayload(items)
  });
}

function handleWatchlistAuthMisconfiguration(message: string, error: unknown) {
  logger.error(message, {
    error,
    remediation: WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION
  });

  return createErrorResponse(
    WATCHLIST_AUTH_MISCONFIGURED_MESSAGE,
    503,
    WATCHLIST_AUTH_MISCONFIGURED_CODE
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
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const items = await getWatchlistForUser(userId);
    return createWatchlistResponse(items);
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist fetch unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist fetch error', { error });
    return createErrorResponse('Failed to fetch watchlist', 500);
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const validation = validateWatchlistMutationBody(
    body as Record<string, unknown>
  );
  if (!validation.ok) {
    return createErrorResponse(validation.message, 400);
  }

  try {
    const items = await applyWatchlistMutation(userId, validation.input);
    return createWatchlistResponse(items);
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist update unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist update error', { error });
    return createErrorResponse('Failed to update watchlist', 500);
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const validation = validateWatchlistPatchBody(
    body as Record<string, unknown>
  );
  if (!validation.ok) {
    return createErrorResponse(validation.message, 400);
  }

  try {
    const items = await applyWatchlistPatch(userId, validation.input);
    return createWatchlistResponse(items);
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist patch unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist patch error', { error });
    return createErrorResponse('Failed to update watchlist', 500);
  }
}
