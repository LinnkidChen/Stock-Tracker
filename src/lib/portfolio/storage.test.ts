import {
  createPortfolioTransaction,
  deletePortfolioTransaction,
  getPortfolioTransactions,
  PortfolioStorageError,
  PortfolioTransactionNotFoundError,
  updatePortfolioTransaction
} from './storage';
import { createClient } from '../supabase/server';

jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}));

const row = {
  id: 'transaction_1',
  clerk_user_id: 'user_123',
  type: 'buy',
  symbol: 'aapl',
  quantity: '10',
  price: '150',
  amount: null,
  fee_amount: '1.5',
  currency: 'USD',
  transaction_date: '2026-01-01T00:00:00.000Z',
  note: 'Initial buy',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z'
};

function createQuery(result: { data: any; error: any }) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => resolve(result)
  };

  return query;
}

describe('portfolio transaction storage', () => {
  const mockCreateClient = createClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and maps transactions for a user', async () => {
    const query = createQuery({ data: [row], error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    const transactions = await getPortfolioTransactions('user_123');

    expect(transactions).toEqual([
      {
        id: 'transaction_1',
        userId: 'user_123',
        type: 'buy',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        amount: null,
        feeAmount: 1.5,
        currency: 'USD',
        transactionDate: '2026-01-01T00:00:00.000Z',
        note: 'Initial buy',
        realizedPnl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ]);
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.order).toHaveBeenCalledWith('transaction_date', {
      ascending: true
    });
  });

  it('throws a storage error when fetch fails', async () => {
    const query = createQuery({
      data: null,
      error: { message: 'database unavailable' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(getPortfolioTransactions('user_123')).rejects.toBeInstanceOf(
      PortfolioStorageError
    );
  });

  it('creates a transaction and uppercases the symbol', async () => {
    const query = createQuery({ data: row, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    const transaction = await createPortfolioTransaction('user_123', {
      type: 'buy',
      symbol: 'aapl',
      quantity: 10,
      price: 150,
      amount: null,
      feeAmount: 1.5,
      currency: 'USD',
      transactionDate: '2026-01-01T00:00:00.000Z',
      note: 'Initial buy'
    });

    expect(transaction.symbol).toBe('AAPL');
    expect(query.insert).toHaveBeenCalledWith({
      clerk_user_id: 'user_123',
      type: 'buy',
      symbol: 'AAPL',
      quantity: 10,
      price: 150,
      amount: null,
      fee_amount: 1.5,
      currency: 'USD',
      transaction_date: '2026-01-01T00:00:00.000Z',
      note: 'Initial buy'
    });
  });

  it('updates a transaction with snake-case database fields', async () => {
    const query = createQuery({ data: row, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await updatePortfolioTransaction('user_123', 'transaction_1', {
      type: 'sell',
      symbol: 'msft',
      quantity: 5,
      price: 250,
      amount: null,
      feeAmount: 2,
      currency: 'USD',
      transactionDate: '2026-01-02T00:00:00.000Z',
      note: null
    });

    expect(query.update).toHaveBeenCalledWith({
      type: 'sell',
      symbol: 'MSFT',
      quantity: 5,
      price: 250,
      amount: null,
      fee_amount: 2,
      currency: 'USD',
      transaction_date: '2026-01-02T00:00:00.000Z',
      note: null
    });
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.eq).toHaveBeenCalledWith('id', 'transaction_1');
  });

  it('maps not-found update errors', async () => {
    const query = createQuery({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(
      updatePortfolioTransaction('user_123', 'missing', {
        type: 'deposit',
        symbol: null,
        quantity: null,
        price: null,
        amount: 100,
        feeAmount: 0,
        currency: 'USD',
        transactionDate: '2026-01-01T00:00:00.000Z',
        note: null
      })
    ).rejects.toBeInstanceOf(PortfolioTransactionNotFoundError);
  });

  it('deletes a transaction for the user', async () => {
    const query = createQuery({ data: { id: 'transaction_1' }, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await deletePortfolioTransaction('user_123', 'transaction_1');

    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.eq).toHaveBeenCalledWith('id', 'transaction_1');
  });

  it('maps not-found delete errors', async () => {
    const query = createQuery({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(
      deletePortfolioTransaction('user_123', 'missing')
    ).rejects.toBeInstanceOf(PortfolioTransactionNotFoundError);
  });
});
