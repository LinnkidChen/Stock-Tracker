/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  consumeAuthenticatedMutationRateLimit,
  consumeMutationAttemptRateLimit
} from '@/lib/rate-limit';
import {
  createPortfolioHolding,
  DuplicatePortfolioHoldingError,
  getPortfolioHoldings
} from '@/lib/portfolio/storage';
import { GET, POST } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/storage', () => {
  const actual = jest.requireActual('@/lib/portfolio/storage');
  return {
    ...actual,
    createPortfolioHolding: jest.fn(),
    getPortfolioHoldings: jest.fn()
  };
});

jest.mock('@/lib/rate-limit', () => ({
  consumeMutationAttemptRateLimit: jest.fn(),
  consumeAuthenticatedMutationRateLimit: jest.fn(),
  recordRateLimitTelemetry: jest.fn(),
  toRateLimitError: jest.fn((result) => result.error)
}));

const holding = {
  id: 'holding_1',
  userId: 'user_123',
  symbol: 'AAPL',
  quantity: 10,
  avgCost: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
};

describe('/api/portfolio/holdings', () => {
  const mockAuth = auth as jest.Mock;
  const mockGet = getPortfolioHoldings as jest.Mock;
  const mockCreate = createPortfolioHolding as jest.Mock;
  const mockMutationAttemptLimit =
    consumeMutationAttemptRateLimit as jest.MockedFunction<
      typeof consumeMutationAttemptRateLimit
    >;
  const mockAuthenticatedMutationLimit =
    consumeAuthenticatedMutationRateLimit as jest.MockedFunction<
      typeof consumeAuthenticatedMutationRateLimit
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationAttemptLimit.mockResolvedValue({
      allowed: true,
      degraded: false,
      policy: 'mutationAttemptsByIp',
      scope: 'mutation-attempt',
      subject: { type: 'ip', id: '127.0.0.1' },
      source: 'upstash'
    });
    mockAuthenticatedMutationLimit.mockResolvedValue({
      allowed: true,
      degraded: false,
      policy: 'authenticatedMutations',
      scope: 'mutation-authenticated',
      subject: { type: 'user', id: 'user_123' },
      source: 'upstash'
    });
  });

  describe('GET', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it('returns holdings for the authenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGet.mockResolvedValue([holding]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.holdings).toEqual([holding]);
      expect(mockGet).toHaveBeenCalledWith('user_123');
    });

    it('returns 503 if portfolio auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGet.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error).toEqual({
        code: 'PORTFOLIO_AUTH_MISCONFIGURED',
        message: 'Portfolio authentication is not configured on the server.'
      });
    });
  });

  describe('POST', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 10,
            avgCost: 150
          })
        })
      );

      expect(res.status).toBe(401);
    });

    it('creates a valid holding', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockCreate.mockResolvedValue(holding);

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'aapl',
            quantity: 10,
            avgCost: 150
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.holding).toEqual(holding);
      expect(mockCreate).toHaveBeenCalledWith('user_123', {
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150
      });
    });

    it('returns 429 if the mutation attempt limiter denies the request', async () => {
      mockMutationAttemptLimit.mockResolvedValueOnce({
        allowed: false,
        degraded: false,
        policy: 'mutationAttemptsByIp',
        scope: 'mutation-attempt',
        subject: { type: 'ip', id: '127.0.0.1' },
        source: 'upstash',
        limit: 30,
        remaining: 0,
        reset: 6000,
        retryAfter: 5,
        headers: {
          'Retry-After': '5',
          'RateLimit-Limit': '30',
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': '6'
        },
        error: {
          code: 'API_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          details: { retryAfter: 5 }
        }
      });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 10,
            avgCost: 150
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('5');
      expect(json.error.code).toBe('API_LIMIT_EXCEEDED');
      expect(mockAuth).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 429 if the authenticated mutation limiter denies the request', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAuthenticatedMutationLimit.mockResolvedValueOnce({
        allowed: false,
        degraded: false,
        policy: 'authenticatedMutations',
        scope: 'mutation-authenticated',
        subject: { type: 'user', id: 'user_123' },
        source: 'upstash',
        limit: 60,
        remaining: 0,
        reset: 6000,
        retryAfter: 5,
        headers: {
          'Retry-After': '5',
          'RateLimit-Limit': '60',
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': '6'
        },
        error: {
          code: 'API_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          details: { retryAfter: 5 }
        }
      });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 10,
            avgCost: 150
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error.details.retryAfter).toBe(5);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid JSON', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: '{'
        })
      );

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid symbol', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL1',
            quantity: 10,
            avgCost: 150
          })
        })
      );

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid numeric fields', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 0,
            avgCost: -1
          })
        })
      );

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 409 for duplicate holdings', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockCreate.mockRejectedValue(new DuplicatePortfolioHoldingError());

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 10,
            avgCost: 150
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('PORTFOLIO_HOLDING_DUPLICATE');
    });

    it('returns 500 if storage fails', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockCreate.mockRejectedValue(new Error('database unavailable'));

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/holdings', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            quantity: 10,
            avgCost: 150
          })
        })
      );

      expect(res.status).toBe(500);
    });
  });
});
