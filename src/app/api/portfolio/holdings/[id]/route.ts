import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
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
import { PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION } from '@/lib/portfolio/api-errors';
import {
  enforcePortfolioMutationAttemptLimit,
  enforcePortfolioRateLimit
} from '@/lib/portfolio/api-rate-limit';
import {
  reportAndCreateObservedErrorResponse,
  toPersistenceErrorCode
} from '@/lib/observability/route-errors';
import type { TelemetrySpan } from '@/lib/observability/error-taxonomy';
import type { APIErrorCode } from '@/lib/types/stock-api';

function createPortfolioError(
  code: APIErrorCode,
  message: string,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown> = {},
  error?: unknown
) {
  return reportAndCreateObservedErrorResponse({
    code,
    message,
    error,
    span,
    context: {
      errorDomain: 'portfolio',
      ...context
    }
  });
}

function createUnauthenticatedError(
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return reportAndCreateObservedErrorResponse({
    code: 'AUTH_UNAUTHENTICATED',
    message: 'Unauthorized',
    span,
    context: {
      errorDomain: 'auth',
      ...context
    }
  });
}

function createPortfolioValidationError(
  message: string,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createPortfolioError(
    getValidationCode(message),
    message,
    span,
    context
  );
}

function handlePortfolioAuthMisconfiguration(
  message: string,
  error: unknown,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createPortfolioError(
    'RLS_AUTH_MISCONFIGURED',
    message,
    span,
    {
      remediation: PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION,
      ...context
    },
    error
  );
}

function handlePortfolioPersistenceError(
  message: string,
  error: unknown,
  span: TelemetrySpan | null | undefined,
  context: Record<string, unknown>
) {
  return createPortfolioError(
    toPersistenceErrorCode(error),
    message,
    span,
    context,
    error
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'PATCH /api/portfolio/holdings/[id]' },
    async (span) => {
      const attemptLimitResponse = await enforcePortfolioMutationAttemptLimit(
        req,
        span
      );
      if (attemptLimitResponse) {
        return attemptLimitResponse;
      }

      const { userId } = await auth();

      if (!userId) {
        return createUnauthenticatedError(span, {
          path: '/api/portfolio/holdings/[id]',
          operation: 'portfolio.update'
        });
      }

      const rateLimitResponse = await enforcePortfolioRateLimit(
        req,
        userId,
        span
      );
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.holding_id', id);
      span?.setAttribute?.('path', '/api/portfolio/holdings/[id]');

      let body: PortfolioHoldingRequestBody;
      try {
        body = await req.json();
      } catch {
        return createPortfolioValidationError('Invalid JSON body', span, {
          path: '/api/portfolio/holdings/[id]',
          operation: 'portfolio.update',
          holdingId: id
        });
      }

      const validation = validatePortfolioHoldingBody(body, { partial: true });
      if (!validation.ok) {
        return createPortfolioValidationError(validation.message, span, {
          path: '/api/portfolio/holdings/[id]',
          operation: 'portfolio.update',
          holdingId: id
        });
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
          return createPortfolioError(
            'RESOURCE_DUPLICATE',
            'Portfolio holding already exists for this symbol',
            span,
            {
              path: '/api/portfolio/holdings/[id]',
              operation: 'portfolio.update',
              holdingId: id,
              symbol: validation.input.symbol
            },
            error
          );
        }
        if (error instanceof PortfolioHoldingNotFoundError) {
          return createPortfolioError(
            'RESOURCE_NOT_FOUND',
            'Portfolio holding not found',
            span,
            {
              path: '/api/portfolio/holdings/[id]',
              operation: 'portfolio.update',
              holdingId: id
            },
            error
          );
        }
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio update unavailable due to auth misconfiguration',
            error,
            span,
            {
              path: '/api/portfolio/holdings/[id]',
              operation: 'portfolio.update',
              holdingId: id,
              symbol: validation.input.symbol
            }
          );
        }

        return handlePortfolioPersistenceError(
          'Portfolio holding update error',
          error,
          span,
          {
            path: '/api/portfolio/holdings/[id]',
            operation: 'portfolio.update',
            holdingId: id,
            symbol: validation.input.symbol
          }
        );
      }
    }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'DELETE /api/portfolio/holdings/[id]' },
    async (span) => {
      const attemptLimitResponse = await enforcePortfolioMutationAttemptLimit(
        req,
        span
      );
      if (attemptLimitResponse) {
        return attemptLimitResponse;
      }

      const { userId } = await auth();

      if (!userId) {
        return createUnauthenticatedError(span, {
          path: '/api/portfolio/holdings/[id]',
          operation: 'portfolio.delete'
        });
      }

      const rateLimitResponse = await enforcePortfolioRateLimit(
        req,
        userId,
        span
      );
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const { id } = await params;
      span?.setAttribute?.('portfolio.holding_id', id);
      span?.setAttribute?.('path', '/api/portfolio/holdings/[id]');

      try {
        await deletePortfolioHolding(userId, id);

        return NextResponse.json({
          success: true,
          data: { id }
        });
      } catch (error) {
        if (error instanceof PortfolioHoldingNotFoundError) {
          return createPortfolioError(
            'RESOURCE_NOT_FOUND',
            'Portfolio holding not found',
            span,
            {
              path: '/api/portfolio/holdings/[id]',
              operation: 'portfolio.delete',
              holdingId: id
            },
            error
          );
        }
        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio delete unavailable due to auth misconfiguration',
            error,
            span,
            {
              path: '/api/portfolio/holdings/[id]',
              operation: 'portfolio.delete',
              holdingId: id
            }
          );
        }

        return handlePortfolioPersistenceError(
          'Portfolio holding delete error',
          error,
          span,
          {
            path: '/api/portfolio/holdings/[id]',
            operation: 'portfolio.delete',
            holdingId: id
          }
        );
      }
    }
  );
}

function getValidationCode(message: string): APIErrorCode {
  return message.toLowerCase().includes('symbol')
    ? 'INVALID_SYMBOL'
    : 'VALIDATION_ERROR';
}
