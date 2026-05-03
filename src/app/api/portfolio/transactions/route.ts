import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { isSupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  createPortfolioTransaction,
  getPortfolioTransactions
} from '@/lib/portfolio/storage';
import {
  PortfolioTransactionRequestBody,
  validatePortfolioTransactionBody
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

export async function GET() {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/portfolio/transactions' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createErrorResponse('Unauthorized', 401);
      }

      try {
        const transactions = await getPortfolioTransactions(userId);
        span?.setAttribute?.(
          'portfolio.transactions_count',
          transactions.length
        );

        return NextResponse.json({
          success: true,
          data: { transactions }
        });
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio transactions fetch unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio transactions fetch error', { error });
        return createErrorResponse(
          'Failed to fetch portfolio transactions',
          500
        );
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

      let body: PortfolioTransactionRequestBody;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      const validation = validatePortfolioTransactionBody(body);
      if (!validation.ok) {
        return createErrorResponse(validation.message, 400);
      }

      span?.setAttribute?.('portfolio.symbol', validation.input.symbol);
      span?.setAttribute?.('portfolio.transaction_type', validation.input.type);

      try {
        const transaction = await createPortfolioTransaction(
          userId,
          validation.input
        );

        return NextResponse.json(
          {
            success: true,
            data: { transaction }
          },
          { status: 201 }
        );
      } catch (error) {
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio transaction create unavailable due to auth misconfiguration',
            error
          );
        }

        logger.error('Portfolio transaction create error', { error });
        return createErrorResponse(
          'Failed to create portfolio transaction',
          500
        );
      }
    }
  );
}
