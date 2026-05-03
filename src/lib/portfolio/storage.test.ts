import {
  createPortfolioHolding,
  deletePortfolioHolding,
  DuplicatePortfolioHoldingError,
  getPortfolioHoldings,
  PortfolioHoldingNotFoundError,
  PortfolioStorageError,
  updatePortfolioHolding
} from './storage';
import { createClient } from '../supabase/server';

jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}));

const row = {
  id: 'holding_1',
  clerk_user_id: 'user_123',
  symbol: 'aapl',
  quantity: '10',
  avg_cost: '150',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z'
};

function createQuery(result: { data: any; error: any }) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve(result)),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve(result))
  };

  return query;
}

describe('portfolio storage', () => {
  const mockCreateClient = createClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and maps holdings for a user', async () => {
    const query = createQuery({ data: [row], error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    const holdings = await getPortfolioHoldings('user_123');

    expect(holdings).toEqual([
      {
        id: 'holding_1',
        userId: 'user_123',
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ]);
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: true
    });
  });

  it('throws a storage error when fetch fails', async () => {
    const query = createQuery({
      data: null,
      error: { message: 'database unavailable' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(getPortfolioHoldings('user_123')).rejects.toBeInstanceOf(
      PortfolioStorageError
    );
  });

  it('creates a holding and uppercases the symbol', async () => {
    const query = createQuery({ data: row, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    const holding = await createPortfolioHolding('user_123', {
      symbol: 'aapl',
      quantity: 10,
      avgCost: 150
    });

    expect(holding.symbol).toBe('AAPL');
    expect(query.insert).toHaveBeenCalledWith({
      clerk_user_id: 'user_123',
      symbol: 'AAPL',
      quantity: 10,
      avg_cost: 150
    });
  });

  it('maps duplicate create errors', async () => {
    const query = createQuery({
      data: null,
      error: { code: '23505', message: 'duplicate key value' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(
      createPortfolioHolding('user_123', {
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150
      })
    ).rejects.toBeInstanceOf(DuplicatePortfolioHoldingError);
  });

  it('updates a holding with snake-case database fields', async () => {
    const query = createQuery({ data: row, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await updatePortfolioHolding('user_123', 'holding_1', {
      symbol: 'msft',
      quantity: 5,
      avgCost: 250
    });

    expect(query.update).toHaveBeenCalledWith({
      symbol: 'MSFT',
      quantity: 5,
      avg_cost: 250
    });
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.eq).toHaveBeenCalledWith('id', 'holding_1');
  });

  it('maps not-found update errors', async () => {
    const query = createQuery({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(
      updatePortfolioHolding('user_123', 'missing', { quantity: 5 })
    ).rejects.toBeInstanceOf(PortfolioHoldingNotFoundError);
  });

  it('deletes a holding for the user', async () => {
    const query = createQuery({ data: { id: 'holding_1' }, error: null });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await deletePortfolioHolding('user_123', 'holding_1');

    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.eq).toHaveBeenCalledWith('id', 'holding_1');
  });

  it('maps not-found delete errors', async () => {
    const query = createQuery({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    });
    mockCreateClient.mockResolvedValue({ from: jest.fn(() => query) });

    await expect(
      deletePortfolioHolding('user_123', 'missing')
    ).rejects.toBeInstanceOf(PortfolioHoldingNotFoundError);
  });
});
