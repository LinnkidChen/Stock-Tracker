import { APIError, APIErrorCode } from '../types/stock-api';
import { isObservedErrorCode } from '../observability/error-taxonomy';

const SECRET_ENV_KEYS = [
  'LONGPORT_APP_KEY',
  'LONGPORT_APP_SECRET',
  'LONGPORT_ACCESS_TOKEN'
] as const;

const NETWORK_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNABORTED'
];

export interface NormalizedLongbridgeError {
  error: APIError;
  retryable: boolean;
  retryAfter?: number;
}

export function normalizeLongbridgeError(
  error: unknown,
  fallbackMessage: string
): NormalizedLongbridgeError {
  if (isAPIError(error)) {
    const retryAfter = normalizeRetryAfter(error.details?.retryAfter);
    const isGuardLimit = error.details?.source === 'longbridge-request-guard';

    return {
      error,
      retryable:
        !isGuardLimit &&
        (error.code === 'API_LIMIT_EXCEEDED' || error.code === 'NETWORK_ERROR'),
      retryAfter
    };
  }

  const statusCode = getStatusCode(error);
  const providerCode = getProviderCode(error);
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const retryAfter = getRetryAfter(error);

  let code: APIErrorCode = 'UNKNOWN_ERROR';
  let apiMessage = fallbackMessage;
  let retryable = false;

  if (isAuthError(normalizedMessage, statusCode)) {
    code = 'INVALID_API_KEY';
    apiMessage = 'Longbridge authentication failed';
  } else if (isRateLimitError(normalizedMessage, statusCode)) {
    code = 'API_LIMIT_EXCEEDED';
    apiMessage = 'Longbridge rate limit exceeded. Please try again shortly.';
    retryable = true;
  } else if (isInvalidSymbolError(normalizedMessage, statusCode)) {
    code = 'INVALID_SYMBOL';
    apiMessage = 'Longbridge symbol was not found or is unsupported';
  } else if (isNetworkError(normalizedMessage, statusCode, providerCode)) {
    code = 'NETWORK_ERROR';
    apiMessage = 'Longbridge network request failed';
    retryable = true;
  }

  const details = createSafeDetails(error, retryAfter);

  return {
    error: {
      code,
      message: apiMessage,
      details
    },
    retryable,
    retryAfter
  };
}

export function sanitizeLongbridgeAPIError(error: APIError): APIError {
  return {
    code: error.code,
    message: redactSecrets(error.message),
    details: sanitizeDetails(error.details)
  };
}

function isAuthError(message: string, statusCode?: number): boolean {
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('invalid token') ||
    message.includes('access token') ||
    message.includes('app key') ||
    message.includes('app secret') ||
    message.includes('auth')
  );
}

function isRateLimitError(message: string, statusCode?: number): boolean {
  return (
    statusCode === 429 ||
    message.includes('rate limit') ||
    message.includes('too many request') ||
    message.includes('frequency') ||
    message.includes('quota') ||
    (message.includes('limit') && message.includes('exceed'))
  );
}

function isInvalidSymbolError(message: string, statusCode?: number): boolean {
  return (
    statusCode === 404 ||
    message.includes('invalid symbol') ||
    message.includes('symbol not found') ||
    message.includes('security not found') ||
    message.includes('unsupported symbol') ||
    message.includes('unknown symbol')
  );
}

function isNetworkError(
  message: string,
  statusCode?: number,
  providerCode?: string
): boolean {
  return (
    (typeof statusCode === 'number' && statusCode >= 500) ||
    NETWORK_ERROR_CODES.some((code) => providerCode === code) ||
    NETWORK_ERROR_CODES.some((code) => message.includes(code.toLowerCase())) ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('socket') ||
    message.includes('aborted') ||
    message.includes('temporarily unavailable') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout')
  );
}

function createSafeDetails(
  error: unknown,
  retryAfter?: number
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    provider: 'longbridge'
  };
  const upstream = getUpstreamDetails(error);

  if (Object.keys(upstream).length > 0) {
    details.upstream = upstream;
  }

  if (retryAfter) {
    details.retryAfter = retryAfter;
  }

  return details;
}

function getUpstreamDetails(error: unknown): Record<string, unknown> {
  const record = asRecord(error);
  const details: Record<string, unknown> = {};
  const name = getStringField(record, 'name');
  const code = getProviderCode(error);
  const statusCode = getStatusCode(error);
  const message = getErrorMessage(error);

  if (name) {
    details.name = redactSecrets(name);
  }

  if (code) {
    details.code = redactSecrets(code);
  }

  if (statusCode) {
    details.statusCode = statusCode;
  }

  if (message) {
    details.message = redactSecrets(message);
  }

  return details;
}

function sanitizeDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(details, (_key, value) => {
      if (typeof value === 'string') {
        return redactSecrets(value);
      }

      return value;
    })
  );
}

function redactSecrets(value: string): string {
  return SECRET_ENV_KEYS.reduce((redacted, key) => {
    const secret = process.env[key];

    if (!secret) {
      return redacted;
    }

    return redacted.split(secret).join('[redacted]');
  }, value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  const record = asRecord(error);
  return getStringField(record, 'message') ?? '';
}

function getProviderCode(error: unknown): string | undefined {
  const record = asRecord(error);
  const code = getStringField(record, 'code');

  if (code) {
    return code;
  }

  const cause = asRecord(record?.cause);
  return getStringField(cause, 'code');
}

function getStatusCode(error: unknown): number | undefined {
  const record = asRecord(error);
  const response = asRecord(record?.response);

  return (
    getNumberField(record, 'status') ??
    getNumberField(record, 'statusCode') ??
    getNumberField(response, 'status') ??
    getNumberField(response, 'statusCode')
  );
}

function getRetryAfter(error: unknown): number | undefined {
  const record = asRecord(error);
  const response = asRecord(record?.response);

  return (
    normalizeRetryAfter(record?.retryAfter) ??
    normalizeRetryAfter(record?.retry_after) ??
    normalizeRetryAfter(getHeader(record?.headers, 'retry-after')) ??
    normalizeRetryAfter(getHeader(response?.headers, 'retry-after'))
  );
}

function getHeader(headers: unknown, key: string): unknown {
  if (!headers) {
    return undefined;
  }

  if (
    typeof headers === 'object' &&
    'get' in headers &&
    typeof (headers as { get: (name: string) => unknown }).get === 'function'
  ) {
    return (headers as { get: (name: string) => unknown }).get(key);
  }

  const record = asRecord(headers);
  return (
    record?.[key] ?? record?.[key.toLowerCase()] ?? record?.[key.toUpperCase()]
  );
}

function normalizeRetryAfter(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.ceil(numericValue);
  }

  const dateValue = Date.parse(value);
  if (!Number.isNaN(dateValue)) {
    const seconds = Math.ceil((dateValue - Date.now()) / 1000);
    return seconds > 0 ? seconds : undefined;
  }

  return undefined;
}

function getStringField(
  record: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(
  record: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function isAPIError(error: unknown): error is APIError {
  const record = asRecord(error);

  return (
    typeof record?.code === 'string' &&
    isObservedErrorCode(record.code) &&
    typeof record?.message === 'string'
  );
}
