import {
  applyErrorSpanAttributes,
  classifyPersistenceError,
  createErrorLogContext,
  createObservedError,
  getErrorTaxonomy,
  type ErrorDomain,
  type TelemetryContext,
  type TelemetrySpan
} from '@/lib/observability/error-taxonomy';
import { logger } from '@/lib/logger';
import {
  createErrorResponse,
  getStatusCodeForError,
  isAPIError
} from '@/lib/services/api-errors';
import type {
  APIError,
  APIErrorCode,
  APIResponse
} from '@/lib/types/stock-api';
import type { NextResponse } from 'next/server';

interface ReportOptions {
  code: APIErrorCode;
  message: string;
  error?: unknown;
  span?: TelemetrySpan | null;
  context?: Record<string, unknown>;
}

interface ResponseOptions {
  code: APIErrorCode;
  message?: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export function reportObservedError({
  code,
  message,
  error,
  span,
  context = {}
}: ReportOptions): void {
  applyErrorSpanAttributes(span, code, toTelemetryContext(context));

  const logContext = createErrorLogContext(code, {
    ...context,
    ...(error ? { error } : {})
  });
  const entry = getErrorTaxonomy(code);

  if (entry.logLevel === 'error') {
    logger.error(message, logContext);
    return;
  }

  logger.warn(message, logContext);
}

export function createObservedErrorResponse<T = null>({
  code,
  message,
  details,
  statusCode
}: ResponseOptions): NextResponse<APIResponse<T>> {
  return createErrorResponse<T>(
    createObservedError(code, { message, details }),
    statusCode
  );
}

export function reportAndCreateObservedErrorResponse<T = null>(
  options: ReportOptions & ResponseOptions
): NextResponse<APIResponse<T>> {
  reportObservedError(options);

  return createObservedErrorResponse<T>(options);
}

export function reportApiError(
  error: APIError,
  message: string,
  span: TelemetrySpan | undefined | null,
  context: Record<string, unknown>
): void {
  reportObservedError({
    code: error.code,
    message,
    error,
    span,
    context: {
      ...context,
      statusCode: getStatusCodeForError(error.code)
    }
  });
}

export function toPersistenceErrorCode(error: unknown): APIErrorCode {
  if (isAPIError(error)) {
    return error.code;
  }

  return classifyPersistenceError(error);
}

export function createErrorDomainContext(
  errorDomain: ErrorDomain,
  context: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    errorDomain,
    ...context
  };
}

function toTelemetryContext(
  context: Record<string, unknown>
): TelemetryContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => {
      return (
        value === null ||
        value === undefined ||
        ['string', 'number', 'boolean'].includes(typeof value)
      );
    })
  ) as TelemetryContext;
}
