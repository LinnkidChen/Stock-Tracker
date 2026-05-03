import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  checkRateLimit,
  createRateLimitHeaders,
  type RateLimitResult
} from '@/lib/rate-limit';

export async function enforcePortfolioRateLimit(
  req: Request,
  userId: string | null
) {
  try {
    const result = await checkRateLimit(req, 'portfolio', {
      subject: userId
    });

    if (!result.allowed) {
      return createPortfolioRateLimitResponse(result);
    }

    return null;
  } catch (error) {
    logger.error('Portfolio rate limiter unavailable', { error });

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

function createPortfolioRateLimitResponse(result: RateLimitResult) {
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
