/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  addPortfolioTransaction,
  getPortfolioSnapshot,
  NegativePortfolioHoldingError
} from '@/lib/portfolio/service';
import { GET, POST } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/service', () => {
  const actual = jest.requireActual('@/lib/portfolio/service');
  return {
    ...actual,
    addPortfolioTransaction: jest.fn(),
    getPortfolioSnapshot: jest.fn()
  };
});

const transaction = {
  id: 'transaction_1',
  userId: 'user_123',
  type: 'buy',
  symbol: 'AAPL',
  quantity: 10,
  price: 150,
  amount: null,
  feeAmount: 0,
  currency: 'USD',
  transactionDate: '2026-01-01T00:00:00.000Z',
  note: null,
  realizedPnl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const snapshot = {
  holdings: [],
  summary: {
    currency: 'USD',
    cashBalance: -1500,
    holdingsCount: 0,
    investedCost: 0,
    realizedPnl: 0,
    dividends: 0,
    fees: 0,
    deposits: 0,
    withdrawals: 0
  },
  transactions: [transaction]
};

describe('/api/portfolio/transactions', () => {
  const mockAuth = auth as jest.Mock;
  const mockGetSnapshot = getPortfolioSnapshot as jest.Mock;
  const mockAdd = addPortfolioTransaction as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 if user is unauthenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it('returns transactions and summary', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGetSnapshot.mockResolvedValue(snapshot);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.transactions).toEqual([transaction]);
      expect(json.data.summary).toEqual(snapshot.summary);
      expect(mockGetSnapshot).toHaveBeenCalledWith('user_123');
    });
  });

  describe('POST', () => {
    it('creates a valid transaction', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockResolvedValue({ transaction, snapshot });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: 'buy',
            symbol: 'aapl',
            quantity: 10,
            price: 150,
            feeAmount: 0,
            currency: 'USD',
            transactionDate: '2026-01-01'
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.transaction).toEqual(transaction);
      expect(mockAdd).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          type: 'buy',
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          currency: 'USD'
        })
      );
    });

    it('returns 400 for invalid payloads', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: 'buy',
            symbol: 'AAPL',
            quantity: 0,
            price: 150
          })
        })
      );

      expect(res.status).toBe(400);
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('returns 409 for transactions that make holdings negative', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockRejectedValue(new NegativePortfolioHoldingError('AAPL'));

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: 'sell',
            symbol: 'AAPL',
            quantity: 10,
            price: 150
          })
        })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('PORTFOLIO_NEGATIVE_HOLDING');
    });

    it('returns 503 if portfolio auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const res = await POST(
        new NextRequest('http://localhost/api/portfolio/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: 'deposit',
            amount: 100,
            currency: 'USD',
            transactionDate: '2026-01-01'
          })
        })
      );

      expect(res.status).toBe(503);
    });
  });
});
