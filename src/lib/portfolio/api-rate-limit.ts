import { NextResponse } from 'next/server';
import {
  consumeAuthenticatedMutationRateLimit,
  consumeMutationAttemptRateLimit,
  toRateLimitError
} from '@/lib/rate-limit';

export async function enforcePortfolioRateLimit(
  req: Request,
  userId: string | null
) {
  const result = userId
    ? await consumeAuthenticatedMutationRateLimit(req, userId)
    : await consumeMutationAttemptRateLimit(req);

  if (result.allowed) {
    return null;
  }

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
