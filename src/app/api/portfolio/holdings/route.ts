import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import { getPortfolioSnapshot } from '@/lib/portfolio/service';
import {
  PORTFOLIO_AUTH_MISCONFIGURED_CODE,
  PORTFOLIO_AUTH_MISCONFIGURED_MESSAGE,
  PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION
} from '@/lib/portfolio/api-errors';

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

function handlePortfolioAuthMisconfiguration(message: string, error: unknown) {
  logger.error(message, {
    error,
    remediation: PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION
  });

  return createErrorResponse(
    PORTFOLIO_AUTH_MISCONFIGURED_MESSAGE,
    503,
    PORTFOLIO_AUTH_MISCONFIGURED_CODE
  );
}

export async function GET() {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/portfolio/holdings' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      span?.setAttribute?.('user.authenticated', true);

      try {
        const snapshot = await getPortfolioSnapshot(userId);
        span?.setAttribute?.(
          'portfolio.holdings_count',
          snapshot.holdings.length
        );

        return NextResponse.json({
          success: true,
          data: {
            holdings: snapshot.holdings,
            summary: snapshot.summary
          }
        });
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio fetch unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio holdings fetch error', { error });
        return createErrorResponse('Failed to fetch portfolio holdings', 500);
      }
    }
  );
}

export async function POST() {
  return createErrorResponse(
    'Portfolio holdings are derived from transactions',
    405,
    'PORTFOLIO_HOLDINGS_DERIVED'
  );
}
