import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
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
import { PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION } from '@/lib/portfolio/api-errors';
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

export async function GET() {
  return Sentry.startSpan(
    { op: 'http.server', name: 'GET /api/portfolio/holdings' },
    async (span) => {
      const { userId } = await auth();
      if (!userId) {
        return createUnauthenticatedError(span, {
          path: '/api/portfolio/holdings',
          operation: 'portfolio.fetch'
        });
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
            error,
            span,
            {
              path: '/api/portfolio/holdings',
              operation: 'portfolio.fetch'
            }
          );
        }

        return handlePortfolioPersistenceError(
          'Portfolio holdings fetch error',
          error,
          span,
          {
            path: '/api/portfolio/holdings',
            operation: 'portfolio.fetch'
          }
        );
      }
    }
  );
}

export async function POST(req: NextRequest) {
  return Sentry.startSpan(
    { op: 'http.server', name: 'POST /api/portfolio/holdings' },
    async (span) => {
      const path = getRequestPath(req, '/api/portfolio/holdings');
      span?.setAttribute?.('path', path);

      const { userId } = await auth();
      if (!userId) {
        return createUnauthenticatedError(span, {
          path,
          operation: 'portfolio.create'
        });
      }

      let body: PortfolioHoldingRequestBody;
      try {
        body = await req.json();
      } catch {
        return createPortfolioValidationError('Invalid JSON body', span, {
          path,
          operation: 'portfolio.create'
        });
      }

      const validation = validatePortfolioHoldingBody(body, { partial: false });
      if (!validation.ok) {
        return createPortfolioValidationError(validation.message, span, {
          path,
          operation: 'portfolio.create'
        });
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
          return createPortfolioError(
            'RESOURCE_DUPLICATE',
            'Portfolio holding already exists for this symbol',
            span,
            {
              path,
              operation: 'portfolio.create',
              symbol: validation.input.symbol
            },
            error
          );
        }

        if (isSupabaseAuthConfigError(error)) {
          return handlePortfolioAuthMisconfiguration(
            'Portfolio create unavailable due to auth misconfiguration',
            error,
            span,
            {
              path,
              operation: 'portfolio.create',
              symbol: validation.input.symbol
            }
          );
        }

        return handlePortfolioPersistenceError(
          'Portfolio holding create error',
          error,
          span,
          {
            path,
            operation: 'portfolio.create',
            symbol: validation.input.symbol
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

function getRequestPath(req: NextRequest, fallback: string): string {
  if (req.nextUrl?.pathname) {
    return req.nextUrl.pathname;
  }

  if (typeof req.url !== 'string') {
    return fallback;
  }

  try {
    return new URL(req.url).pathname;
  } catch {
    return fallback;
  }
}
