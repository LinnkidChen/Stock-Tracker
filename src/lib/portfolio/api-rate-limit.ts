import { NextResponse } from 'next/server';
import {
  consumeAuthenticatedMutationRateLimit,
  consumeMutationAttemptRateLimit,
  recordRateLimitTelemetry,
  type RateLimitTelemetryTarget,
  type RateLimitResult,
  toRateLimitError
} from '@/lib/rate-limit';

export async function enforcePortfolioRateLimit(
  req: Request,
  userId: string | null,
  telemetryTarget?: RateLimitTelemetryTarget | null
) {
  const result = userId
    ? await consumeAuthenticatedMutationRateLimit(req, userId)
    : await consumeMutationAttemptRateLimit(req);
  recordRateLimitTelemetry(telemetryTarget, result);

  if (result.allowed) {
    return null;
  }

  return createPortfolioRateLimitResponse(result);
}

export async function enforcePortfolioMutationAttemptLimit(
  req: Request,
  telemetryTarget?: RateLimitTelemetryTarget | null
) {
  const result = await consumeMutationAttemptRateLimit(req);
  recordRateLimitTelemetry(telemetryTarget, result);

  if (result.allowed) {
    return null;
  }

  return createPortfolioRateLimitResponse(result);
}

export function createPortfolioRateLimitResponse(result: RateLimitResult) {
  const error = result.error ?? toRateLimitError(result);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    },
    {
      status: 429,
      headers: result.headers
    }
  );
}
