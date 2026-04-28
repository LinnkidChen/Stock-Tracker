import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  addPortfolioTransaction,
  InvalidPortfolioTransactionError,
  NegativePortfolioHoldingError,
  getPortfolioSnapshot
} from '@/lib/portfolio/service';
import { validatePortfolioTransactionBody } from '@/lib/portfolio/validation';
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

  if (isSupabaseAuthConfigError(error)) {
    return handlePortfolioAuthMisconfiguration(
      'Portfolio transactions unavailable due to auth misconfiguration',
      error
    );
  }

  logger.error('Portfolio transaction error', { error });
  return createErrorResponse('Failed to process portfolio transaction', 500);
}

export async function GET() {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/portfolio/transactions' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      try {
        const snapshot = await getPortfolioSnapshot(userId);
        span?.setAttribute?.(
          'portfolio.transactions_count',
          snapshot.transactions.length
        );

        return NextResponse.json({
          success: true,
          data: {
            transactions: snapshot.transactions,
            summary: snapshot.summary
          }
        });
      } catch (error) {
        return handleTransactionError(error);
      }
    }
  );
}

export async function POST(req: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/portfolio/transactions' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      const validation = validatePortfolioTransactionBody(
        body as Record<string, unknown>
      );
      if (!validation.ok) {
        return createErrorResponse(validation.message, 400);
      }

      span?.setAttribute?.('portfolio.transaction_type', validation.input.type);
      if (validation.input.symbol) {
        span?.setAttribute?.('portfolio.symbol', validation.input.symbol);
      }

      try {
        const result = await addPortfolioTransaction(userId, validation.input);

        return NextResponse.json(
          {
            success: true,
            data: {
              transaction:
                result.snapshot.transactions.find(
                  (transaction) => transaction.id === result.transaction?.id
                ) ?? result.transaction,
              holdings: result.snapshot.holdings,
              summary: result.snapshot.summary
            }
          },
          { status: 201 }
        );
      } catch (error) {
        return handleTransactionError(error);
      }
    }
  );
}
