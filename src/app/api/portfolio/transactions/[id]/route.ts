import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  editPortfolioTransaction,
  InvalidPortfolioTransactionError,
  NegativePortfolioHoldingError,
  PortfolioTransactionNotFoundError,
  removePortfolioTransaction
} from '@/lib/portfolio/service';
import { validatePortfolioTransactionPatchBody } from '@/lib/portfolio/validation';
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

function handleTransactionError(error: unknown) {
  if (error instanceof InvalidPortfolioTransactionError) {
    return createErrorResponse(error.message, 400);
  }

  if (error instanceof NegativePortfolioHoldingError) {
    return createErrorResponse(
      error.message,
      409,
      'PORTFOLIO_NEGATIVE_HOLDING'
    );
  }

  if (error instanceof PortfolioTransactionNotFoundError) {
    return createErrorResponse('Portfolio transaction not found', 404);
  }

  if (isSupabaseAuthConfigError(error)) {
    return handlePortfolioAuthMisconfiguration(
      'Portfolio transaction unavailable due to auth misconfiguration',
      error
    );
  }

  logger.error('Portfolio transaction mutation error', { error });
  return createErrorResponse('Failed to process portfolio transaction', 500);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'PATCH /api/portfolio/transactions/[id]' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.transaction_id', id);

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      const validation = validatePortfolioTransactionPatchBody(
        body as Record<string, unknown>
      );
      if (!validation.ok) {
        return createErrorResponse(validation.message, 400);
      }

      try {
        const result = await editPortfolioTransaction(
          userId,
          id,
          validation.input
        );

        return NextResponse.json({
          success: true,
          data: {
            transaction:
              result.snapshot.transactions.find(
                (transaction) => transaction.id === result.transaction?.id
              ) ?? result.transaction,
            holdings: result.snapshot.holdings,
            summary: result.snapshot.summary
          }
        });
      } catch (error) {
        return handleTransactionError(error);
      }
    }
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'DELETE /api/portfolio/transactions/[id]' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.transaction_id', id);

      try {
        const result = await removePortfolioTransaction(userId, id);

        return NextResponse.json({
          success: true,
          data: {
            id,
            holdings: result.snapshot.holdings,
            summary: result.snapshot.summary
          }
        });
      } catch (error) {
        return handleTransactionError(error);
      }
    }
  );
}
