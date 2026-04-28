import type { APIError, APIErrorCode } from '@/lib/types/stock-api';

export type ErrorCategory =
  | 'auth'
  | 'persistence'
  | 'provider'
  | 'rate_limit'
  | 'validation'
  | 'unknown';

export type ErrorDomain =
  | 'auth'
  | 'portfolio'
  | 'stock-data'
  | 'watchlist'
  | 'system';

export type ErrorLogLevel = 'warn' | 'error';
export type SentrySeverity = 'warning' | 'error' | 'fatal';

export interface AlertThreshold {
  eventCount: number;
  windowMinutes: number;
  severity: 'warning' | 'critical';
  description: string;
}

export interface ErrorTaxonomyEntry {
  code: APIErrorCode;
  category: ErrorCategory;
  defaultDomain: ErrorDomain;
  dashboardMessage: string;
  operatorMessage: string;
  httpStatus: number;
  logLevel: ErrorLogLevel;
  sentrySeverity: SentrySeverity;
  alertThreshold: AlertThreshold;
}

export interface TelemetrySpan {
  setAttribute?: (key: string, value: string | number | boolean) => void;
  setAttributes?: (
    attributes: Record<string, string | number | boolean>
  ) => void;
}

type TelemetryValue = string | number | boolean | null | undefined;

export type TelemetryContext = Record<string, TelemetryValue>;

export interface ErrorLogContext extends Record<string, unknown> {
  errorCode: APIErrorCode;
  errorCategory: ErrorCategory;
  errorDomain: ErrorDomain;
  dashboardMessage: string;
  operatorMessage: string;
  alertThreshold: string;
  sentryTags: Record<string, string>;
  sentryLevel: SentrySeverity;
}

export const ERROR_TAXONOMY = {
  INVALID_SYMBOL: {
    code: 'INVALID_SYMBOL',
    category: 'validation',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Ticker symbol is invalid or unsupported.',
    operatorMessage: 'Ticker symbol validation failed.',
    httpStatus: 400,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 50,
      windowMinutes: 10,
      severity: 'warning',
      description:
        'Alert when invalid symbol responses exceed expected user-input noise.'
    }
  },
  INVALID_INTERVAL: {
    code: 'INVALID_INTERVAL',
    category: 'validation',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Requested chart interval is not supported.',
    operatorMessage: 'K-line interval validation failed.',
    httpStatus: 400,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 25,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when invalid chart interval responses spike.'
    }
  },
  INVALID_PROVIDER: {
    code: 'INVALID_PROVIDER',
    category: 'validation',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Requested quote provider is not supported.',
    operatorMessage: 'Quote provider validation failed.',
    httpStatus: 400,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 10,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when clients request unsupported quote providers.'
    }
  },
  API_LIMIT_EXCEEDED: {
    code: 'API_LIMIT_EXCEEDED',
    category: 'rate_limit',
    defaultDomain: 'system',
    dashboardMessage: 'Too many requests. Please try again shortly.',
    operatorMessage: 'Rate limit threshold exceeded.',
    httpStatus: 429,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 10,
      windowMinutes: 5,
      severity: 'warning',
      description: 'Alert when rate limit responses occur repeatedly.'
    }
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    category: 'provider',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Market data is temporarily unavailable.',
    operatorMessage: 'Market data provider network request failed.',
    httpStatus: 502,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 3,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert on repeated provider network failures.'
    }
  },
  INVALID_API_KEY: {
    code: 'INVALID_API_KEY',
    category: 'provider',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Market data provider credentials are not configured.',
    operatorMessage: 'Market data provider authentication failed.',
    httpStatus: 401,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 1,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert immediately when provider credentials fail.'
    }
  },
  AUTH_UNAUTHENTICATED: {
    code: 'AUTH_UNAUTHENTICATED',
    category: 'auth',
    defaultDomain: 'auth',
    dashboardMessage: 'Sign in to continue.',
    operatorMessage: 'Request was made without an authenticated Clerk user.',
    httpStatus: 401,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 50,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when unauthenticated API calls spike.'
    }
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    category: 'validation',
    defaultDomain: 'system',
    dashboardMessage: 'Review the request and try again.',
    operatorMessage: 'Request validation failed.',
    httpStatus: 400,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 50,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when validation failures exceed normal usage.'
    }
  },
  RLS_AUTH_MISCONFIGURED: {
    code: 'RLS_AUTH_MISCONFIGURED',
    category: 'persistence',
    defaultDomain: 'system',
    dashboardMessage: 'Data persistence is temporarily unavailable.',
    operatorMessage:
      'Supabase RLS authentication is misconfigured for Clerk-issued tokens.',
    httpStatus: 503,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 1,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert immediately when Supabase RLS auth is misconfigured.'
    }
  },
  RLS_ACCESS_DENIED: {
    code: 'RLS_ACCESS_DENIED',
    category: 'persistence',
    defaultDomain: 'system',
    dashboardMessage: 'You do not have access to this data.',
    operatorMessage: 'Supabase RLS policy denied the persistence operation.',
    httpStatus: 403,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 3,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert on repeated Supabase RLS policy denials.'
    }
  },
  PERSISTENCE_FAILURE: {
    code: 'PERSISTENCE_FAILURE',
    category: 'persistence',
    defaultDomain: 'system',
    dashboardMessage: 'Data could not be saved right now.',
    operatorMessage: 'Persistence operation failed.',
    httpStatus: 500,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 3,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert on repeated Supabase persistence failures.'
    }
  },
  RESOURCE_DUPLICATE: {
    code: 'RESOURCE_DUPLICATE',
    category: 'validation',
    defaultDomain: 'system',
    dashboardMessage: 'This item already exists.',
    operatorMessage: 'Duplicate resource conflict.',
    httpStatus: 409,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 25,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when duplicate resource conflicts spike.'
    }
  },
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    category: 'validation',
    defaultDomain: 'system',
    dashboardMessage: 'The requested item was not found.',
    operatorMessage: 'Requested resource was not found.',
    httpStatus: 404,
    logLevel: 'warn',
    sentrySeverity: 'warning',
    alertThreshold: {
      eventCount: 25,
      windowMinutes: 10,
      severity: 'warning',
      description: 'Alert when missing resource responses spike.'
    }
  },
  PROVIDER_FAILURE: {
    code: 'PROVIDER_FAILURE',
    category: 'provider',
    defaultDomain: 'stock-data',
    dashboardMessage: 'Market data provider failed to complete the request.',
    operatorMessage: 'Market data provider returned an unexpected failure.',
    httpStatus: 502,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 3,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert on repeated market data provider failures.'
    }
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    category: 'unknown',
    defaultDomain: 'system',
    dashboardMessage: 'An unexpected error occurred.',
    operatorMessage: 'Unhandled application error.',
    httpStatus: 500,
    logLevel: 'error',
    sentrySeverity: 'error',
    alertThreshold: {
      eventCount: 3,
      windowMinutes: 5,
      severity: 'critical',
      description: 'Alert on repeated unclassified application errors.'
    }
  }
} as const satisfies Record<APIErrorCode, ErrorTaxonomyEntry>;

const ERROR_CODE_SET = new Set<string>(Object.keys(ERROR_TAXONOMY));

export function isObservedErrorCode(code: unknown): code is APIErrorCode {
  return typeof code === 'string' && ERROR_CODE_SET.has(code);
}

export function getErrorTaxonomy(code: APIErrorCode): ErrorTaxonomyEntry {
  return ERROR_TAXONOMY[code] ?? ERROR_TAXONOMY.UNKNOWN_ERROR;
}

export function getErrorStatusCode(code: APIErrorCode): number {
  return getErrorTaxonomy(code).httpStatus;
}

export function getDashboardErrorMessage(error: APIError): string {
  if (typeof error.details?.dashboardMessage === 'string') {
    return error.details.dashboardMessage;
  }

  if (shouldPreserveSpecificMessage(error.code)) {
    return error.message || getErrorTaxonomy(error.code).dashboardMessage;
  }

  return getErrorTaxonomy(error.code).dashboardMessage;
}

export function createObservedError(
  code: APIErrorCode,
  options: {
    message?: string;
    details?: Record<string, unknown>;
  } = {}
): APIError {
  return {
    code,
    message: options.message ?? getErrorTaxonomy(code).dashboardMessage,
    details: options.details
  };
}

export function toDashboardError(error: APIError): APIError {
  return {
    code: error.code,
    message: getDashboardErrorMessage(error),
    details: getResponseDetails(error)
  };
}

export function createErrorLogContext(
  code: APIErrorCode,
  context: Record<string, unknown> = {}
): ErrorLogContext {
  const entry = getErrorTaxonomy(code);
  const { sentryTags, sentryLevel, ...extraContext } = context as {
    sentryTags?: Record<string, string>;
    sentryLevel?: SentrySeverity;
  } & Record<string, unknown>;

  return {
    ...extraContext,
    errorCode: entry.code,
    errorCategory: entry.category,
    errorDomain:
      typeof context.errorDomain === 'string'
        ? (context.errorDomain as ErrorDomain)
        : entry.defaultDomain,
    dashboardMessage: entry.dashboardMessage,
    operatorMessage: entry.operatorMessage,
    alertThreshold: formatAlertThreshold(entry.alertThreshold),
    sentryTags: {
      ...getSentryTags(entry, context),
      ...(sentryTags ?? {})
    },
    sentryLevel: sentryLevel ?? entry.sentrySeverity
  };
}

export function applyErrorSpanAttributes(
  span: TelemetrySpan | undefined | null,
  code: APIErrorCode,
  context: TelemetryContext = {}
): void {
  const entry = getErrorTaxonomy(code);
  const attributes: Record<string, string | number | boolean> = {
    'error.code': entry.code,
    'error.category': entry.category,
    'error.domain':
      typeof context.errorDomain === 'string'
        ? context.errorDomain
        : entry.defaultDomain,
    'error.log_level': entry.logLevel,
    'error.alert.threshold': formatAlertThreshold(entry.alertThreshold)
  };

  Object.entries(context).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      key === 'errorDomain' ||
      typeof value === 'object'
    ) {
      return;
    }

    attributes[`error.context.${key}`] = value;
  });

  if (typeof span?.setAttributes === 'function') {
    span.setAttributes(attributes);
    return;
  }

  if (typeof span?.setAttribute === 'function') {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute?.(key, value);
    });
  }
}

export function classifyPersistenceError(error: unknown): APIErrorCode {
  return isRlsPolicyError(error) ? 'RLS_ACCESS_DENIED' : 'PERSISTENCE_FAILURE';
}

export function formatAlertThreshold(threshold: AlertThreshold): string {
  return `${threshold.eventCount} events / ${threshold.windowMinutes} min (${threshold.severity})`;
}

function shouldPreserveSpecificMessage(code: APIErrorCode): boolean {
  return [
    'INVALID_SYMBOL',
    'INVALID_INTERVAL',
    'VALIDATION_ERROR',
    'RESOURCE_DUPLICATE',
    'RESOURCE_NOT_FOUND'
  ].includes(code);
}

function getResponseDetails(
  error: APIError
): Record<string, unknown> | undefined {
  if (error.code === 'API_LIMIT_EXCEEDED') {
    const retryAfter = error.details?.retryAfter;
    return retryAfter ? { retryAfter } : undefined;
  }

  return undefined;
}

function getSentryTags(
  entry: ErrorTaxonomyEntry,
  context: Record<string, unknown>
): Record<string, string> {
  const tags: Record<string, string> = {
    'app.error_code': entry.code,
    'app.error_category': entry.category,
    'app.error_domain':
      typeof context.errorDomain === 'string'
        ? context.errorDomain
        : entry.defaultDomain,
    'app.alert_threshold': formatAlertThreshold(entry.alertThreshold)
  };

  addStringTag(tags, 'app.provider', context.provider);
  addStringTag(tags, 'app.route', context.path);
  addStringTag(tags, 'app.operation', context.operation);

  return tags;
}

function addStringTag(
  tags: Record<string, string>,
  key: string,
  value: unknown
): void {
  if (typeof value === 'string' && value.trim()) {
    tags[key] = value;
  }
}

function isRlsPolicyError(error: unknown): boolean {
  return getErrorCandidates(error).some((candidate) => {
    const record = asRecord(candidate);
    const code = String(record?.code ?? '');
    const message = String(record?.message ?? '').toLowerCase();
    const details = String(record?.details ?? '').toLowerCase();

    return (
      code === '42501' ||
      message.includes('row-level security') ||
      message.includes('permission denied') ||
      details.includes('row-level security') ||
      details.includes('permission denied')
    );
  });
}

function getErrorCandidates(error: unknown): unknown[] {
  const record = asRecord(error);
  return [error, record?.originalError, record?.cause].filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}
