import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  deletePortfolioHolding,
  DuplicatePortfolioHoldingError,
  PortfolioHoldingNotFoundError,
  updatePortfolioHolding
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'PATCH /api/portfolio/holdings/[id]' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.holding_id', id);

      let body: PortfolioHoldingRequestBody;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      const validation = validatePortfolioHoldingBody(body, { partial: true });
      if (!validation.ok) {
        return createErrorResponse(validation.message, 400);
      }

      try {
        const holding = await updatePortfolioHolding(
          userId,
          id,
          validation.input
        );

        return NextResponse.json({
          success: true,
          data: { holding }
        });
      } catch (error) {
        if (error instanceof DuplicatePortfolioHoldingError) {
          return createErrorResponse(
            'Portfolio holding already exists for this symbol',
            409,
            'PORTFOLIO_HOLDING_DUPLICATE'
          );
        }
        if (error instanceof PortfolioHoldingNotFoundError) {
          return createErrorResponse('Portfolio holding not found', 404);
        }
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio update unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio holding update error', { error });
        return createErrorResponse('Failed to update portfolio holding', 500);
      }
    }
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'DELETE /api/portfolio/holdings/[id]' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.holding_id', id);

      try {
        await deletePortfolioHolding(userId, id);

        return NextResponse.json({
          success: true,
          data: { id }
        });
      } catch (error) {
        if (error instanceof PortfolioHoldingNotFoundError) {
          return createErrorResponse('Portfolio holding not found', 404);
        }
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio delete unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio holding delete error', { error });
        return createErrorResponse('Failed to delete portfolio holding', 500);
      }
    }
  );
}
