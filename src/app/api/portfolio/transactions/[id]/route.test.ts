/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  editPortfolioTransaction,
  PortfolioTransactionNotFoundError,
  removePortfolioTransaction
} from '@/lib/portfolio/service';
import { DELETE, PATCH } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/service', () => {
  const actual = jest.requireActual('@/lib/portfolio/service');
  return {
    ...actual,
    editPortfolioTransaction: jest.fn(),
    removePortfolioTransaction: jest.fn()
  };
});

const params = { params: Promise.resolve({ id: 'transaction_1' }) };

const transaction = {
  id: 'transaction_1',
  userId: 'user_123',
  type: 'deposit',
  symbol: null,
  quantity: null,
  price: null,
  amount: 100,
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
    cashBalance: 100,
    holdingsCount: 0,
    investedCost: 0,
    realizedPnl: 0,
    dividends: 0,
    fees: 0,
    deposits: 100,
    withdrawals: 0
  },
  transactions: [transaction]
};

describe('/api/portfolio/transactions/[id]', () => {
  const mockAuth = auth as jest.Mock;
  const mockEdit = editPortfolioTransaction as jest.Mock;
  const mockRemove = removePortfolioTransaction as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a transaction', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockEdit.mockResolvedValue({ transaction, snapshot });

    const res = await PATCH(
      new NextRequest(
        'http://localhost/api/portfolio/transactions/transaction_1',
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: 100 })
        }
      ),
      params
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.transaction).toEqual(transaction);
    expect(mockEdit).toHaveBeenCalledWith('user_123', 'transaction_1', {
      amount: 100
    });
  });

  it('returns 400 for an empty patch', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const res = await PATCH(
      new NextRequest(
        'http://localhost/api/portfolio/transactions/transaction_1',
        {
          method: 'PATCH',
          body: JSON.stringify({})
        }
      ),
      params
    );

    expect(res.status).toBe(400);
    expect(mockEdit).not.toHaveBeenCalled();
  });

  it('returns 404 for missing transactions', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockEdit.mockRejectedValue(new PortfolioTransactionNotFoundError());

    const res = await PATCH(
      new NextRequest(
        'http://localhost/api/portfolio/transactions/transaction_1',
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: 100 })
        }
      ),
      params
    );

    expect(res.status).toBe(404);
  });

  it('deletes a transaction', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockRemove.mockResolvedValue({ snapshot });

    const res = await DELETE(
      new NextRequest(
        'http://localhost/api/portfolio/transactions/transaction_1',
        {
          method: 'DELETE'
        }
      ),
      params
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe('transaction_1');
    expect(mockRemove).toHaveBeenCalledWith('user_123', 'transaction_1');
  });
});
