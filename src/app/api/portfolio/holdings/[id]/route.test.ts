/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  deletePortfolioHolding,
  DuplicatePortfolioHoldingError,
  PortfolioHoldingNotFoundError,
  updatePortfolioHolding
} from '@/lib/portfolio/storage';
import { enforcePortfolioRateLimit } from '@/lib/portfolio/api-rate-limit';
import { DELETE, PATCH } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/api-rate-limit', () => ({
  enforcePortfolioRateLimit: jest.fn()
}));

jest.mock('@/lib/portfolio/storage', () => {
  const actual = jest.requireActual('@/lib/portfolio/storage');
  return {
    ...actual,
    deletePortfolioHolding: jest.fn(),
    updatePortfolioHolding: jest.fn()
  };
});

const holding = {
  id: 'holding_1',
  userId: 'user_123',
  symbol: 'MSFT',
  quantity: 5,
  avgCost: 250,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
};

const params = { params: Promise.resolve({ id: 'holding_1' }) };

describe('/api/portfolio/holdings/[id]', () => {
  const mockAuth = auth as jest.Mock;
  const mockEnforceRateLimit = enforcePortfolioRateLimit as jest.Mock;
  const mockUpdate = updatePortfolioHolding as jest.Mock;
  const mockDelete = deletePortfolioHolding as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
  });

  describe('PATCH', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({ quantity: 5 })
        }),
        params
      );

      expect(res.status).toBe(401);
    });

    it('returns rate limit responses before parsing the patch', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockEnforceRateLimit.mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: 'API_LIMIT_EXCEEDED' }
          },
          { status: 429 }
        )
      );

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({ quantity: 5 })
        }),
        params
      );

      expect(res.status).toBe(429);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('updates a holding', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockResolvedValue(holding);

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({
            symbol: 'msft',
            quantity: 5,
            avgCost: 250
          })
        }),
        params
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.holding).toEqual(holding);
      expect(mockUpdate).toHaveBeenCalledWith('user_123', 'holding_1', {
        symbol: 'MSFT',
        quantity: 5,
        avgCost: 250
      });
    });

    it('returns 400 for an empty patch', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({})
        }),
        params
      );

      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns 409 for duplicate symbols', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockRejectedValue(new DuplicatePortfolioHoldingError());

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({ symbol: 'AAPL' })
        }),
        params
      );

      expect(res.status).toBe(409);
    });

    it('returns 404 for missing holdings', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockRejectedValue(new PortfolioHoldingNotFoundError());

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({ quantity: 5 })
        }),
        params
      );

      expect(res.status).toBe(404);
    });

    it('returns 503 if portfolio auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const res = await PATCH(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'PATCH',
          body: JSON.stringify({ quantity: 5 })
        }),
        params
      );

      expect(res.status).toBe(503);
    });
  });

  describe('DELETE', () => {
    it('deletes a holding', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockDelete.mockResolvedValue(undefined);

      const res = await DELETE(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'DELETE'
        }),
        params
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe('holding_1');
      expect(mockDelete).toHaveBeenCalledWith('user_123', 'holding_1');
    });

    it('returns 404 for missing holdings', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockDelete.mockRejectedValue(new PortfolioHoldingNotFoundError());

      const res = await DELETE(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'DELETE'
        }),
        params
      );

      expect(res.status).toBe(404);
    });

    it('returns 500 if delete storage fails', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockDelete.mockRejectedValue(new Error('database unavailable'));

      const res = await DELETE(
        new NextRequest('http://localhost/api/portfolio/holdings/holding_1', {
          method: 'DELETE'
        }),
        params
      );

      expect(res.status).toBe(500);
    });
  });
});
