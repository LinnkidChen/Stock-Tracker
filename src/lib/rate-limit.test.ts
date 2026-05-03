/**
 * @jest-environment node
 */
import {
  checkRateLimit,
  createRateLimitHeaders,
  RateLimitUnavailableError
} from './rate-limit';

const originalEnv = process.env;
const originalFetch = global.fetch;

function mockJsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  } as Response;
}

describe('rate limit store', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      RATE_LIMIT_DISABLED: ''
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('allows requests without a configured store outside production', async () => {
    const result = await checkRateLimit(
      new Request('http://localhost/api/stocks/quote/AAPL'),
      'quote'
    );

    expect(result.allowed).toBe(true);
    expect(result.source).toBe('disabled');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createRateLimitHeaders(result)).toEqual({});
  });

  it('checks the Supabase RPC store with the scope policy', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse([
        {
          allowed: true,
          remaining: 119,
          reset_at: '2026-01-01T00:01:00.000Z',
          retry_after_seconds: null
        }
      ])
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.RATE_LIMIT_KEY_SALT = 'test-salt';

    const result = await checkRateLimit(
      new Request('http://localhost/api/stocks/quote/AAPL', {
        headers: {
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'jest-client'
        }
      }),
      'quote'
    );
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe(
      'https://example.supabase.co/rest/v1/rpc/check_api_rate_limit'
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        apikey: 'service-role-key',
        Authorization: 'Bearer service-role-key',
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    expect(body).toMatchObject({
      p_limit: 120,
      p_window_seconds: 60
    });
    expect(body.p_bucket_key).toMatch(/^quote:/);
    expect(result).toMatchObject({
      allowed: true,
      limit: 120,
      remaining: 119,
      source: 'supabase'
    });
    expect(createRateLimitHeaders(result)).toEqual({
      'X-RateLimit-Limit': '120',
      'X-RateLimit-Remaining': '119',
      'X-RateLimit-Reset': String(
        Math.ceil(Date.parse('2026-01-01T00:01:00.000Z') / 1000)
      )
    });
  });

  it('returns retry metadata when the store rejects a request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse([
        {
          allowed: false,
          remaining: 0,
          reset_at: '2026-01-01T00:01:00.000Z',
          retry_after_seconds: 7
        }
      ])
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const result = await checkRateLimit(
      new Request('http://localhost/api/ws/prices'),
      'stream'
    );

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(7);
    expect(createRateLimitHeaders(result)).toMatchObject({
      'Retry-After': '7',
      'X-RateLimit-Limit': '20',
      'X-RateLimit-Remaining': '0'
    });
  });

  it('fails closed in production when the store is not configured', async () => {
    process.env.NODE_ENV = 'production';

    await expect(
      checkRateLimit(new Request('http://localhost/api/ws/prices'), 'stream')
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});
