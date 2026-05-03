import { logger } from '@/lib/logger';

export type RateLimitScope =
  | 'quote'
  | 'kline'
  | 'watchlist'
  | 'portfolio'
  | 'stream';

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult extends RateLimitPolicy {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  source: 'supabase' | 'disabled';
}

type SupabaseRateLimitRow = {
  allowed?: unknown;
  remaining?: unknown;
  reset_at?: unknown;
  retry_after_seconds?: unknown;
};

const DEFAULT_RATE_LIMIT_POLICIES: Record<RateLimitScope, RateLimitPolicy> = {
  quote: { limit: 120, windowSeconds: 60 },
  kline: { limit: 60, windowSeconds: 60 },
  watchlist: { limit: 60, windowSeconds: 60 },
  portfolio: { limit: 60, windowSeconds: 60 },
  stream: { limit: 20, windowSeconds: 60 }
};

export class RateLimitUnavailableError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RateLimitUnavailableError';
  }
}

export async function checkRateLimit(
  request: Request,
  scope: RateLimitScope,
  options: { subject?: string | null } = {}
): Promise<RateLimitResult> {
  const policy = getRateLimitPolicy(scope);
  const config = getSupabaseRateLimitConfig();

  if (isRateLimitDisabled(config)) {
    return {
      allowed: true,
      remaining: policy.limit,
      resetAt: Date.now() + policy.windowSeconds * 1000,
      source: 'disabled',
      ...policy
    };
  }

  if (!config) {
    throw new RateLimitUnavailableError('Rate limit store is not configured', {
      scope,
      requiredEnv: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    });
  }

  const identity = getRateLimitIdentity(request, options.subject);
  const bucketKey = await createBucketKey(scope, identity);
  const endpoint = new URL(
    '/rest/v1/rpc/check_api_rate_limit',
    config.supabaseUrl
  );

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_bucket_key: bucketKey,
        p_limit: policy.limit,
        p_window_seconds: policy.windowSeconds
      }),
      cache: 'no-store'
    });
  } catch (error) {
    throw new RateLimitUnavailableError('Rate limit store request failed', {
      scope,
      error
    });
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    logger.error('Rate limit store returned an error', {
      scope,
      status: response.status,
      body
    });

    throw new RateLimitUnavailableError('Rate limit store returned an error', {
      scope,
      status: response.status
    });
  }

  const payload = await response.json();
  return parseSupabaseRateLimitResult(payload, policy);
}

export function createRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  if (result.source === 'disabled') {
    return {};
  }

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

export function getRateLimitIdentity(
  request: Request,
  subject?: string | null
): string {
  if (subject) {
    return `user:${subject}`;
  }

  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  const ip =
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    forwardedIp ||
    'anonymous';
  const userAgent = headers.get('user-agent')?.slice(0, 120) || 'unknown';

  return `ip:${ip}:ua:${userAgent}`;
}

function getRateLimitPolicy(scope: RateLimitScope): RateLimitPolicy {
  const defaults = DEFAULT_RATE_LIMIT_POLICIES[scope];
  const envPrefix = `RATE_LIMIT_${scope.toUpperCase()}`;

  return {
    limit:
      parsePositiveInteger(process.env[`${envPrefix}_LIMIT`]) ?? defaults.limit,
    windowSeconds:
      parsePositiveInteger(process.env[`${envPrefix}_WINDOW_SECONDS`]) ??
      defaults.windowSeconds
  };
}

function getSupabaseRateLimitConfig(): {
  supabaseUrl: string;
  serviceRoleKey: string;
} | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

function isRateLimitDisabled(
  config: ReturnType<typeof getSupabaseRateLimitConfig>
): boolean {
  const explicitValue = process.env.RATE_LIMIT_DISABLED?.toLowerCase();
  if (explicitValue === 'true' || explicitValue === '1') {
    return true;
  }

  return !config && process.env.NODE_ENV !== 'production';
}

async function createBucketKey(
  scope: RateLimitScope,
  identity: string
): Promise<string> {
  const salt = process.env.RATE_LIMIT_KEY_SALT || 'stock-tracker';
  return `${scope}:${await hashValue(`${salt}:${identity}`)}`;
}

async function hashValue(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    );

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return fallbackHash(value);
}

function fallbackHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseSupabaseRateLimitResult(
  payload: unknown,
  policy: RateLimitPolicy
): RateLimitResult {
  const row = (Array.isArray(payload) ? payload[0] : payload) as
    | SupabaseRateLimitRow
    | undefined;

  if (!row || typeof row.allowed !== 'boolean') {
    throw new RateLimitUnavailableError(
      'Rate limit store returned an invalid response'
    );
  }

  const resetAt = parseResetAt(row.reset_at);
  const remaining = Math.max(0, parseInteger(row.remaining) ?? 0);
  const retryAfter =
    parsePositiveInteger(row.retry_after_seconds) ??
    (!row.allowed
      ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      : undefined);

  return {
    allowed: row.allowed,
    remaining,
    resetAt,
    retryAfter,
    source: 'supabase',
    ...policy
  };
}

function parseResetAt(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new RateLimitUnavailableError(
    'Rate limit store returned an invalid reset timestamp'
  );
}

function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = parseInteger(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
