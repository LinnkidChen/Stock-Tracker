import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';
import type { APIError } from './types/stock-api';

export type RateLimitSubjectType = 'ip' | 'user' | 'global';

export interface RateLimitSubject {
  type: RateLimitSubjectType;
  id: string;
}

type RateLimitSource = 'upstash' | 'disabled' | 'error';

export type RateLimitPolicyName =
  | 'anonymousStockReads'
  | 'authenticatedStockReads'
  | 'mutationAttemptsByIp'
  | 'authenticatedMutations'
  | 'webSocketUpgrades'
  | 'longbridgeQuoteBudget'
  | 'longbridgeKlineBudget'
  | 'longbridgeHealthBudget'
  | 'longbridgeDailyBudget';

interface RateLimitPolicy {
  key: string;
  scope: string;
  envKey: string;
  defaultLimit: number;
  window: Duration;
}

interface ResolvedRateLimitPolicy extends RateLimitPolicy {
  limit: number;
}

interface UpstashLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
  reason?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  policy: RateLimitPolicyName;
  scope: string;
  subject: RateLimitSubject;
  source: RateLimitSource;
  degraded: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
  reason?: string;
  headers?: Record<string, string>;
  error?: APIError;
}

export interface RateLimitTelemetryTarget {
  setAttribute?: (key: string, value: string | number | boolean) => void;
}

const DEFAULT_WS_MAX_SYMBOLS = 30;

const RATE_LIMIT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  anonymousStockReads: {
    key: 'stock-read-anonymous',
    scope: 'stock-read',
    envKey: 'RATE_LIMIT_ANON_STOCK_READS_PER_MINUTE',
    defaultLimit: 120,
    window: '60 s'
  },
  authenticatedStockReads: {
    key: 'stock-read-authenticated',
    scope: 'stock-read',
    envKey: 'RATE_LIMIT_AUTH_STOCK_READS_PER_MINUTE',
    defaultLimit: 300,
    window: '60 s'
  },
  mutationAttemptsByIp: {
    key: 'mutation-attempt-ip',
    scope: 'mutation-attempt',
    envKey: 'RATE_LIMIT_MUTATION_ATTEMPTS_PER_MINUTE',
    defaultLimit: 30,
    window: '60 s'
  },
  authenticatedMutations: {
    key: 'mutation-authenticated',
    scope: 'mutation-authenticated',
    envKey: 'RATE_LIMIT_AUTH_MUTATIONS_PER_MINUTE',
    defaultLimit: 60,
    window: '60 s'
  },
  webSocketUpgrades: {
    key: 'websocket-upgrade',
    scope: 'websocket-upgrade',
    envKey: 'RATE_LIMIT_WS_UPGRADES_PER_MINUTE',
    defaultLimit: 30,
    window: '60 s'
  },
  longbridgeQuoteBudget: {
    key: 'longbridge-quote',
    scope: 'provider-budget',
    envKey: 'LONGBRIDGE_QUOTE_BUDGET_PER_MINUTE',
    defaultLimit: 600,
    window: '60 s'
  },
  longbridgeKlineBudget: {
    key: 'longbridge-kline',
    scope: 'provider-budget',
    envKey: 'LONGBRIDGE_KLINE_BUDGET_PER_MINUTE',
    defaultLimit: 60,
    window: '60 s'
  },
  longbridgeHealthBudget: {
    key: 'longbridge-health',
    scope: 'provider-budget',
    envKey: 'LONGBRIDGE_HEALTH_BUDGET_PER_MINUTE',
    defaultLimit: 30,
    window: '60 s'
  },
  longbridgeDailyBudget: {
    key: 'longbridge-daily',
    scope: 'provider-budget',
    envKey: 'LONGBRIDGE_DAILY_BUDGET',
    defaultLimit: 20_000,
    window: '1 d'
  }
};

const SAFE_IP_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip'
] as const;

const limiterCache = new Map<string, Ratelimit>();
const degradedWarningKeys = new Set<string>();
let redisClient: Redis | null | undefined;

export function getRateLimitConfig() {
  const policies = Object.fromEntries(
    Object.entries(RATE_LIMIT_POLICIES).map(([name, policy]) => [
      name,
      resolvePolicy(policy as RateLimitPolicy)
    ])
  ) as Record<RateLimitPolicyName, ResolvedRateLimitPolicy>;

  return {
    upstashConfigured: hasUpstashRedisConfig(),
    webSocketMaxSymbols: getWebSocketMaxSymbols(),
    policies
  };
}

export function getClientIp(request: Request): string {
  for (const header of SAFE_IP_HEADERS) {
    const value = request.headers.get(header);
    const candidate = value?.split(',')[0]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const nextRequestIp = (request as Request & { ip?: string }).ip?.trim();
  return nextRequestIp || 'anonymous';
}

export function createRateLimitSubject(
  request: Request,
  userId?: string | null
): RateLimitSubject {
  if (userId) {
    return {
      type: 'user',
      id: userId
    };
  }

  return {
    type: 'ip',
    id: getClientIp(request)
  };
}

export async function consumeStockReadRateLimit(
  request: Request,
  userId?: string | null
): Promise<RateLimitResult> {
  const subject = createRateLimitSubject(request, userId);
  const policy =
    subject.type === 'user' ? 'authenticatedStockReads' : 'anonymousStockReads';

  return consumeRateLimit(policy, subject, request);
}

export async function consumeMutationAttemptRateLimit(
  request: Request
): Promise<RateLimitResult> {
  return consumeRateLimit(
    'mutationAttemptsByIp',
    { type: 'ip', id: getClientIp(request) },
    request
  );
}

export async function consumeAuthenticatedMutationRateLimit(
  request: Request,
  userId: string
): Promise<RateLimitResult> {
  return consumeRateLimit(
    'authenticatedMutations',
    { type: 'user', id: userId },
    request
  );
}

export async function consumeWebSocketUpgradeRateLimit(
  request: Request
): Promise<RateLimitResult> {
  return consumeRateLimit(
    'webSocketUpgrades',
    { type: 'ip', id: getClientIp(request) },
    request
  );
}

export async function consumeLongbridgeProviderBudget(
  kind: 'quote' | 'kline' | 'health'
): Promise<RateLimitResult> {
  const specificPolicy: RateLimitPolicyName =
    kind === 'quote'
      ? 'longbridgeQuoteBudget'
      : kind === 'kline'
        ? 'longbridgeKlineBudget'
        : 'longbridgeHealthBudget';
  const subject: RateLimitSubject = { type: 'global', id: 'global' };
  const specificResult = await consumeRateLimit(specificPolicy, subject);

  if (!specificResult.allowed) {
    return specificResult;
  }

  return consumeRateLimit('longbridgeDailyBudget', subject);
}

export async function consumeRateLimit(
  policyName: RateLimitPolicyName,
  subject: RateLimitSubject,
  request?: Request
): Promise<RateLimitResult> {
  const policy = resolvePolicy(RATE_LIMIT_POLICIES[policyName]);
  const baseResult = createBaseResult(policyName, policy, subject);

  if (!hasUpstashRedisConfig()) {
    return {
      ...baseResult,
      allowed: true,
      degraded: true,
      source: 'disabled',
      limit: policy.limit
    };
  }

  try {
    const limiter = getLimiter(policyName, policy);
    const response = (await limiter.limit(createIdentifier(policy, subject), {
      ip:
        subject.type === 'ip'
          ? subject.id
          : getRequestHeader(request, 'x-forwarded-for'),
      userAgent: getRequestHeader(request, 'user-agent')
    })) as UpstashLimitResponse;

    void response.pending?.catch((error) => {
      logger.warn('Rate limit background task failed', {
        error,
        scope: policy.scope,
        policy: policy.key
      });
    });

    const degraded = response.reason === 'timeout';
    if (degraded) {
      warnDegradedOnce(policy.key, 'Rate limiter timed out; request allowed', {
        scope: policy.scope,
        policy: policy.key
      });
    }

    if (response.success) {
      return {
        ...baseResult,
        allowed: true,
        degraded,
        source: 'upstash',
        limit: response.limit,
        remaining: response.remaining,
        reset: response.reset,
        reason: response.reason
      };
    }

    const retryAfter = getRetryAfterSeconds(response.reset);
    const deniedResult: RateLimitResult = {
      ...baseResult,
      allowed: false,
      degraded: false,
      source: 'upstash',
      limit: response.limit,
      remaining: Math.max(0, response.remaining),
      reset: response.reset,
      retryAfter,
      reason: response.reason,
      headers: createRateLimitHeaders({
        limit: response.limit,
        remaining: response.remaining,
        reset: response.reset,
        retryAfter
      })
    };

    return {
      ...deniedResult,
      error: toRateLimitError(deniedResult)
    };
  } catch (error) {
    warnDegradedOnce(policy.key, 'Rate limiter unavailable; request allowed', {
      error,
      scope: policy.scope,
      policy: policy.key
    });

    return {
      ...baseResult,
      allowed: true,
      degraded: true,
      source: 'error',
      limit: policy.limit
    };
  }
}

export function toRateLimitError(result: RateLimitResult): APIError {
  return {
    code: 'API_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded. Please try again later.',
    details: {
      retryAfter: result.retryAfter,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      scope: result.scope,
      policy: result.policy,
      subjectType: result.subject.type,
      source: result.source,
      reason: result.reason
    }
  };
}

export function recordRateLimitTelemetry(
  target: RateLimitTelemetryTarget | null | undefined,
  result: RateLimitResult
) {
  target?.setAttribute?.('rate_limit.scope', result.scope);
  target?.setAttribute?.('rate_limit.subject_type', result.subject.type);
  target?.setAttribute?.('rate_limit.allowed', result.allowed);
  target?.setAttribute?.('rate_limit.source', result.source);
  target?.setAttribute?.('rate_limit.degraded', result.degraded);

  if (typeof result.limit === 'number') {
    target?.setAttribute?.('rate_limit.limit', result.limit);
  }
  if (typeof result.remaining === 'number') {
    target?.setAttribute?.('rate_limit.remaining', result.remaining);
  }
  if (typeof result.reset === 'number') {
    target?.setAttribute?.('rate_limit.reset', result.reset);
  }
}

export function getWebSocketMaxSymbols(): number {
  return readPositiveIntegerEnv(
    'RATE_LIMIT_WS_MAX_SYMBOLS',
    DEFAULT_WS_MAX_SYMBOLS
  );
}

export function resetRateLimitForTests() {
  limiterCache.clear();
  degradedWarningKeys.clear();
  redisClient = undefined;
}

function getLimiter(
  policyName: RateLimitPolicyName,
  policy: ResolvedRateLimitPolicy
): Ratelimit {
  const cacheKey = `${policyName}:${policy.limit}:${policy.window}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Upstash Redis is not configured');
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `stock-tracker:${policy.key}`,
    analytics: true,
    enableProtection: true,
    timeout: 750
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function hasUpstashRedisConfig(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function resolvePolicy(policy: RateLimitPolicy): ResolvedRateLimitPolicy {
  return {
    ...policy,
    limit: readPositiveIntegerEnv(policy.envKey, policy.defaultLimit)
  };
}

function readPositiveIntegerEnv(key: string, fallback: number): number {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createIdentifier(
  policy: ResolvedRateLimitPolicy,
  subject: RateLimitSubject
): string {
  return `${policy.key}:${subject.type}:${subject.id}`;
}

function createBaseResult(
  policyName: RateLimitPolicyName,
  policy: ResolvedRateLimitPolicy,
  subject: RateLimitSubject
): RateLimitResult {
  return {
    allowed: true,
    degraded: false,
    policy: policyName,
    scope: policy.scope,
    subject,
    source: 'upstash'
  };
}

function createRateLimitHeaders(input: {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}): Record<string, string> {
  return {
    'Retry-After': String(input.retryAfter),
    'RateLimit-Limit': String(input.limit),
    'RateLimit-Remaining': String(Math.max(0, input.remaining)),
    'RateLimit-Reset': String(Math.ceil(input.reset / 1000))
  };
}

function getRetryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

function getRequestHeader(
  request: Request | undefined,
  name: string
): string | undefined {
  const value = request?.headers.get(name)?.trim();
  return value || undefined;
}

function warnDegradedOnce(
  key: string,
  message: string,
  context?: Record<string, unknown>
) {
  if (degradedWarningKeys.has(key)) {
    return;
  }

  degradedWarningKeys.add(key);
  logger.warn(message, context);
}
