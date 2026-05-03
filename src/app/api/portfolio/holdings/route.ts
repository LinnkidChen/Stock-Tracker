import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  createPortfolioHolding,
  DuplicatePortfolioHoldingError,
  getPortfolioHoldings
} from '@/lib/portfolio/storage';
import {
  PortfolioHoldingRequestBody,
  validatePortfolioHoldingBody
} from '@/lib/portfolio/validation';
import {
  PORTFOLIO_AUTH_MISCONFIGURED_CODE,
  PORTFOLIO_AUTH_MISCONFIGURED_MESSAGE,
  PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION
} from '@/lib/portfolio/api-errors';
import { enforcePortfolioRateLimit } from '@/lib/portfolio/api-rate-limit';

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

function createPortfolioAuthMisconfiguredResponse() {
  return createErrorResponse(
    PORTFOLIO_AUTH_MISCONFIGURED_MESSAGE,
    503,
    PORTFOLIO_AUTH_MISCONFIGURED_CODE
  );
}

function handlePortfolioAuthMisconfiguration(message: string, error: unknown) {
  logger.error(message, {
    error,
    remediation: PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION
  });

  return createPortfolioAuthMisconfiguredResponse();
}

export async function GET(req: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/portfolio/holdings' },
    async (span) => {
      const { userId } = await auth();
      const rateLimitResponse = await enforcePortfolioRateLimit(req, userId);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      span?.setAttribute?.('user.authenticated', true);

      try {
        const holdings = await getPortfolioHoldings(userId);
        span?.setAttribute?.('portfolio.holdings_count', holdings.length);

        return NextResponse.json({
          success: true,
          data: { holdings }
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

export async function POST(req: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/portfolio/holdings' },
    async (span) => {
      const { userId } = await auth();
      const rateLimitResponse = await enforcePortfolioRateLimit(req, userId);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      let body: PortfolioHoldingRequestBody;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      const validation = validatePortfolioHoldingBody(body, { partial: false });
      if (!validation.ok) {
        return createErrorResponse(validation.message, 400);
      }

      span?.setAttribute?.('portfolio.symbol', validation.input.symbol);

      try {
        const holding = await createPortfolioHolding(userId, validation.input);

        return NextResponse.json(
          {
            success: true,
            data: { holding }
          },
          { status: 201 }
        );
      } catch (error) {
        if (error instanceof DuplicatePortfolioHoldingError) {
          return createErrorResponse(
            'Portfolio holding already exists for this symbol',
            409,
            'PORTFOLIO_HOLDING_DUPLICATE'
          );
        }

        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio create unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio holding create error', { error });
        return createErrorResponse('Failed to create portfolio holding', 500);
      }
    }
  );
}
