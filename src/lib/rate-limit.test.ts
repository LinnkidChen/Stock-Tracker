/**
 * @jest-environment node
 */
const mockLimit = jest.fn();
const mockRedisConstructor = jest.fn();
const mockRatelimitConstructor = jest.fn();
const mockSlidingWindow = jest.fn((tokens: number, window: string) => ({
  tokens,
  window
}));

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation((config) => {
    mockRedisConstructor(config);
    return { config };
  })
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: jest.fn().mockImplementation((config) => {
    mockRatelimitConstructor(config);
    return {
      limit: mockLimit
    };
  })
}));

jest.mock('./logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { Ratelimit } from '@upstash/ratelimit';
import {
  consumeRateLimit,
  consumeStockReadRateLimit,
  createRateLimitSubject,
  getClientIp,
  getRateLimitConfig,
  resetRateLimitForTests,
  toRateLimitError
} from './rate-limit';

(
  Ratelimit as unknown as { slidingWindow: typeof mockSlidingWindow }
).slidingWindow = mockSlidingWindow;

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: new Headers(headers)
  } as Request;
}

describe('rate-limit helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitForTests();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_ANON_STOCK_READS_PER_MINUTE;
    delete process.env.RATE_LIMIT_WS_MAX_SYMBOLS;
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses defaults and positive integer overrides', () => {
    process.env.RATE_LIMIT_ANON_STOCK_READS_PER_MINUTE = '42';
    process.env.RATE_LIMIT_WS_MAX_SYMBOLS = '12';
    process.env.RATE_LIMIT_AUTH_MUTATIONS_PER_MINUTE = '-1';

    const config = getRateLimitConfig();

    expect(config.upstashConfigured).toBe(false);
    expect(config.policies.anonymousStockReads.limit).toBe(42);
    expect(config.policies.authenticatedMutations.limit).toBe(60);
    expect(config.webSocketMaxSymbols).toBe(12);
  });

  it('derives IP and authenticated subjects from request data', () => {
    const request = createRequest({
      'x-forwarded-for': '203.0.113.10, 10.0.0.1'
    });

    expect(getClientIp(request)).toBe('203.0.113.10');
    expect(createRateLimitSubject(request)).toEqual({
      type: 'ip',
      id: '203.0.113.10'
    });
    expect(createRateLimitSubject(request, 'user_123')).toEqual({
      type: 'user',
      id: 'user_123'
    });
  });

  it('fails open when Upstash is not configured', async () => {
    const result = await consumeStockReadRateLimit(createRequest());

    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.source).toBe('disabled');
    expect(mockRatelimitConstructor).not.toHaveBeenCalled();
  });

  it('returns structured 429 metadata when Upstash denies a request', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    mockLimit.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 6_000,
      pending: Promise.resolve(undefined)
    });

    const result = await consumeRateLimit(
      'mutationAttemptsByIp',
      { type: 'ip', id: '203.0.113.10' },
      createRequest({ 'user-agent': 'Jest' })
    );
    const error = toRateLimitError(result);

    expect(result.allowed).toBe(false);
    expect(result.headers).toEqual({
      'Retry-After': '5',
      'RateLimit-Limit': '30',
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': '6'
    });
    expect(error).toMatchObject({
      code: 'API_LIMIT_EXCEEDED',
      details: {
        retryAfter: 5,
        limit: 30,
        scope: 'mutation-attempt',
        subjectType: 'ip',
        source: 'upstash'
      }
    });
    expect(mockRedisConstructor).toHaveBeenCalledWith({
      url: 'https://redis.example.com',
      token: 'token'
    });
    expect(mockSlidingWindow).toHaveBeenCalledWith(30, '60 s');
    expect(mockLimit).toHaveBeenCalledWith(
      'mutation-attempt-ip:ip:203.0.113.10',
      expect.objectContaining({
        ip: '203.0.113.10',
        userAgent: 'Jest'
      })
    );
  });

  it('fails open when the Upstash check throws', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    mockLimit.mockRejectedValue(new Error('redis unavailable'));

    const result = await consumeStockReadRateLimit(createRequest());

    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.source).toBe('error');
  });
});
