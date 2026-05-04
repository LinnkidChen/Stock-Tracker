/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  createPortfolioTransaction,
  getPortfolioTransactions
} from '@/lib/portfolio/storage';
import { GET, POST } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/storage', () => {
  const actual = jest.requireActual('@/lib/portfolio/storage');
  return {
    ...actual,
    createPortfolioTransaction: jest.fn(),
    getPortfolioTransactions: jest.fn()
  };
});

const transaction = {
  id: 'transaction_1',
  userId: 'user_123',
  symbol: 'AAPL',
  type: 'buy',
  quantity: 10,
  price: 150,
  amount: null,
  fee: 1,
  splitRatioFrom: null,
  splitRatioTo: null,
  occurredAt: '2026-01-01T00:00:00.000Z',
  note: 'Opening lot',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('/api/portfolio/transactions', () => {
  const mockAuth = auth as jest.Mock;
  const mockGet = getPortfolioTransactions as jest.Mock;
  const mockCreate = createPortfolioTransaction as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it('returns transactions for the authenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGet.mockResolvedValue([transaction]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.transactions).toEqual([transaction]);
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
        code: 'RLS_AUTH_MISCONFIGURED',
        message: 'Data persistence is temporarily unavailable.'
      });
    });
  });

  describe('POST', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            type: 'buy',
            quantity: 10,
            price: 150
          })
        })
      );

      expect(res.status).toBe(401);
    });

    it('creates a valid transaction', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockCreate.mockResolvedValue(transaction);

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'aapl',
            type: 'buy',
            quantity: 10,
            price: 150,
            fee: 1,
            occurredAt: '2026-01-01T00:00:00.000Z',
            note: ' Opening lot '
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.transaction).toEqual(transaction);
      expect(mockCreate).toHaveBeenCalledWith('user_123', {
        symbol: 'AAPL',
        type: 'buy',
        quantity: 10,
        price: 150,
        fee: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        note: 'Opening lot'
      });
    });

    it('returns 400 for invalid JSON', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: '{'
        })
      );

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid transaction shape', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            type: 'split',
            splitRatioFrom: 1,
            splitRatioTo: 0
          })
        })
      );

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 500 if storage fails', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockCreate.mockRejectedValue(new Error('database unavailable'));

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            symbol: 'AAPL',
            type: 'buy',
            quantity: 10,
            price: 150
          })
        })
      );

      expect(res.status).toBe(500);
    });
  });
});
