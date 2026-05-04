import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  createWatchlistAlert,
  deleteWatchlistAlert,
  getWatchlistAlerts,
  getWatchlistAlertTriggers,
  updateWatchlistAlert,
  WatchlistAlertNotFoundError
} from '@/lib/watchlist/alerts-storage';
import {
  WATCHLIST_ALERT_STATUSES,
  WATCHLIST_ALERT_TYPES,
  type WatchlistAlertStatus,
  type WatchlistAlertType
} from '@/types/alerts';

const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
const WATCHLIST_AUTH_MISCONFIGURED_MESSAGE =
  'Watchlist authentication is not configured on the server.';
const WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION =
  'Configure Clerk JWT template "supabase" and configure Supabase JWT verification for Clerk-issued tokens.';

interface CreateAlertRequestBody {
  symbol?: unknown;
  type?: unknown;
  threshold?: unknown;
}

interface UpdateAlertRequestBody {
  id?: unknown;
  type?: unknown;
  threshold?: unknown;
  status?: unknown;
}

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

function parseAlertType(value: unknown): WatchlistAlertType | null {
  if (typeof value !== 'string') return null;

  return WATCHLIST_ALERT_TYPES.includes(value as WatchlistAlertType)
    ? (value as WatchlistAlertType)
    : null;
}

function parseAlertStatus(value: unknown): WatchlistAlertStatus | null {
  if (typeof value !== 'string') return null;

  return WATCHLIST_ALERT_STATUSES.includes(value as WatchlistAlertStatus)
    ? (value as WatchlistAlertStatus)
    : null;
}

function parseThreshold(
  type: WatchlistAlertType,
  value: unknown
): { ok: true; threshold: number } | { ok: false; message: string } {
  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, message: 'Threshold must be greater than 0' };
  }

  if (type === 'volume_spike' && threshold < 1) {
    return {
      ok: false,
      message: 'Volume spike multiplier must be at least 1'
    };
  }

  return { ok: true, threshold };
}

function parseId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const [alerts, triggers] = await Promise.all([
      getWatchlistAlerts(userId),
      getWatchlistAlertTriggers(userId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        triggers
      }
    });
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist alerts fetch unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist alerts fetch error', { error });
    return createErrorResponse('Failed to fetch watchlist alerts', 500);
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  let body: CreateAlertRequestBody;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  if (typeof body.symbol !== 'string') {
    return createErrorResponse('Ticker symbol is required', 400);
  }

  const symbol = normalizeTicker(body.symbol);
  if (!isValidTicker(symbol)) {
    return createErrorResponse('Invalid ticker symbol', 400);
  }

  const type = parseAlertType(body.type);
  if (!type) {
    return createErrorResponse('Invalid alert type', 400);
  }

  const threshold = parseThreshold(type, body.threshold);
  if (!threshold.ok) {
    return createErrorResponse(threshold.message, 400);
  }

  try {
    const alert = await createWatchlistAlert(userId, {
      symbol,
      type,
      threshold: threshold.threshold
    });

    return NextResponse.json(
      {
        success: true,
        data: { alert }
      },
      { status: 201 }
    );
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist alert create unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist alert create error', { error });
    return createErrorResponse('Failed to create watchlist alert', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  let body: UpdateAlertRequestBody;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  const id = parseId(body.id);
  if (!id) {
    return createErrorResponse('Alert id is required', 400);
  }

  const updates: Parameters<typeof updateWatchlistAlert>[2] = {};

  if (body.type !== undefined) {
    const type = parseAlertType(body.type);
    if (!type) {
      return createErrorResponse('Invalid alert type', 400);
    }
    updates.type = type;
  }

  if (body.status !== undefined) {
    const status = parseAlertStatus(body.status);
    if (!status) {
      return createErrorResponse('Invalid alert status', 400);
    }
    updates.status = status;
  }

  if (body.threshold !== undefined) {
    const typeForThreshold = updates.type;
    if (!typeForThreshold) {
      return createErrorResponse(
        'Alert type is required when updating threshold',
        400
      );
    }

    const threshold = parseThreshold(typeForThreshold, body.threshold);
    if (!threshold.ok) {
      return createErrorResponse(threshold.message, 400);
    }
    updates.threshold = threshold.threshold;
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse('At least one field is required', 400);
  }

  try {
    const alert = await updateWatchlistAlert(userId, id, updates);

    return NextResponse.json({
      success: true,
      data: { alert }
    });
  } catch (error) {
    if (error instanceof WatchlistAlertNotFoundError) {
      return createErrorResponse('Watchlist alert not found', 404);
    }

    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist alert update unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist alert update error', { error });
    return createErrorResponse('Failed to update watchlist alert', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return createErrorResponse('Alert id is required', 400);
  }

  try {
    await deleteWatchlistAlert(userId, id);

    return NextResponse.json({
      success: true,
      data: { id }
    });
  } catch (error) {
    if (error instanceof WatchlistAlertNotFoundError) {
      return createErrorResponse('Watchlist alert not found', 404);
    }

    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist alert delete unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist alert delete error', { error });
    return createErrorResponse('Failed to delete watchlist alert', 500);
  }
}
