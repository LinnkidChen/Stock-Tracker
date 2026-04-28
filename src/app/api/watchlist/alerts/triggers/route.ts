import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  WatchlistAlertNotActiveError,
  recordWatchlistAlertTrigger,
  WatchlistAlertNotFoundError
} from '@/lib/watchlist/alerts-storage';

const WATCHLIST_AUTH_MISCONFIGURED_CODE = 'WATCHLIST_AUTH_MISCONFIGURED';
const WATCHLIST_AUTH_MISCONFIGURED_MESSAGE =
  'Watchlist authentication is not configured on the server.';
const WATCHLIST_AUTH_MISCONFIGURED_REMEDIATION =
  'Configure Clerk JWT template "supabase" and configure Supabase JWT verification for Clerk-issued tokens.';

interface TriggerRequestBody {
  alertId?: unknown;
  observedValue?: unknown;
  observedPrice?: unknown;
  message?: unknown;
  triggeredAt?: unknown;
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

function parseFiniteNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return {
      ok: false as const,
      message: `${fieldName} must be a finite number`
    };
  }

  return { ok: true as const, value: parsed };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  let body: TriggerRequestBody;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 400);
  }

  if (typeof body.alertId !== 'string' || !body.alertId.trim()) {
    return createErrorResponse('Alert id is required', 400);
  }

  const observedValue = parseFiniteNumber(body.observedValue, 'observedValue');
  if (!observedValue.ok) {
    return createErrorResponse(observedValue.message, 400);
  }

  let observedPrice: number | null = null;
  if (body.observedPrice !== undefined && body.observedPrice !== null) {
    const parsedPrice = parseFiniteNumber(body.observedPrice, 'observedPrice');
    if (!parsedPrice.ok) {
      return createErrorResponse(parsedPrice.message, 400);
    }
    observedPrice = parsedPrice.value;
  }

  if (typeof body.message !== 'string' || !body.message.trim()) {
    return createErrorResponse('Message is required', 400);
  }

  const message = body.message.trim().slice(0, 280);
  const triggeredAt =
    typeof body.triggeredAt === 'string' && body.triggeredAt.trim()
      ? body.triggeredAt.trim()
      : undefined;

  try {
    const result = await recordWatchlistAlertTrigger(userId, {
      alertId: body.alertId.trim(),
      observedValue: observedValue.value,
      observedPrice,
      message,
      triggeredAt
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof WatchlistAlertNotFoundError) {
      return createErrorResponse('Watchlist alert not found', 404);
    }

    if (error instanceof WatchlistAlertNotActiveError) {
      return createErrorResponse('Watchlist alert is not active', 409);
    }

    if (isSupabaseAuthConfigError(error)) {
      return handleWatchlistAuthMisconfiguration(
        'Watchlist alert trigger unavailable due to auth misconfiguration',
        error
      );
    }

    logger.error('Watchlist alert trigger error', { error });
    return createErrorResponse('Failed to record watchlist alert trigger', 500);
  }
}
