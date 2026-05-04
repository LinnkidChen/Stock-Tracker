/**
 * @jest-environment node
 */
import {
  addToWatchlist,
  getWatchlist,
  getWatchlistItems,
  reorderWatchlistItems,
  updateWatchlistItemMetadata
} from './storage';
import { createClient } from '../supabase/server';
import type { WatchlistItem } from '@/types/watchlist';

jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}));

function createItem(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: 'item-1',
    symbol: 'AAPL',
    exchange: null,
    note: null,
    sort_order: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function createQuery(result: unknown) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    delete: jest.fn(() => query),
    update: jest.fn(() => query),
    upsert: jest.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject)
  };

  return query;
}

function createSupabase(...queries: any[]) {
  const from = jest.fn();

  queries.forEach((query) => from.mockReturnValueOnce(query));
  from.mockReturnValue(queries[queries.length - 1]);

  return { from };
}

describe('watchlist storage', () => {
  const mockCreateClient = createClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches watchlist items with metadata ordering', async () => {
    const items = [
      createItem({ symbol: 'AAPL', exchange: 'NASDAQ', sort_order: 0 }),
      createItem({ id: 'item-2', symbol: 'MSFT', exchange: 'NASDAQ' })
    ];
    const query = createQuery({ data: items, error: null });
    const supabase = createSupabase(query);

    mockCreateClient.mockResolvedValue(supabase);

    await expect(getWatchlistItems('user_123')).resolves.toEqual(items);
    expect(supabase.from).toHaveBeenCalledWith('stock_watchlist_items');
    expect(query.select).toHaveBeenCalledWith(
      'id,symbol,exchange,note,sort_order,created_at,updated_at'
    );
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(query.order).toHaveBeenNthCalledWith(1, 'exchange', {
      ascending: true,
      nullsFirst: false
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'sort_order', {
      ascending: true,
      nullsFirst: false
    });
    expect(query.order).toHaveBeenNthCalledWith(3, 'created_at', {
      ascending: true
    });
  });

  it('keeps a symbol-only getter for compatibility', async () => {
    const items = [
      createItem({ symbol: 'AAPL' }),
      createItem({ id: 'item-2', symbol: 'MSFT' })
    ];
    const query = createQuery({ data: items, error: null });

    mockCreateClient.mockResolvedValue(createSupabase(query));

    await expect(getWatchlist('user_123')).resolves.toEqual(['AAPL', 'MSFT']);
  });

  it('adds symbols with normalized symbol and metadata', async () => {
    const items = [
      createItem({ symbol: 'AAPL', exchange: 'NASDAQ', note: 'Core' })
    ];
    const upsertQuery = createQuery({ error: null });
    const fetchQuery = createQuery({ data: items, error: null });

    mockCreateClient
      .mockResolvedValueOnce(createSupabase(upsertQuery))
      .mockResolvedValueOnce(createSupabase(fetchQuery));

    await expect(
      addToWatchlist('user_123', 'aapl', {
        exchange: 'NASDAQ',
        note: 'Core'
      })
    ).resolves.toEqual(items);

    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      {
        clerk_user_id: 'user_123',
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        note: 'Core'
      },
      { onConflict: 'clerk_user_id,symbol', ignoreDuplicates: true }
    );
  });

  it('updates item metadata', async () => {
    const items = [createItem({ symbol: 'AAPL', exchange: 'NYSE' })];
    const updateQuery = createQuery({ error: null });
    const fetchQuery = createQuery({ data: items, error: null });

    mockCreateClient
      .mockResolvedValueOnce(createSupabase(updateQuery))
      .mockResolvedValueOnce(createSupabase(fetchQuery));

    await expect(
      updateWatchlistItemMetadata('user_123', 'aapl', {
        exchange: 'NYSE',
        note: null
      })
    ).resolves.toEqual(items);

    expect(updateQuery.update).toHaveBeenCalledWith({
      exchange: 'NYSE',
      note: null
    });
    expect(updateQuery.eq).toHaveBeenCalledWith('symbol', 'AAPL');
  });

  it('persists sort orders for reorder operations', async () => {
    const items = [
      createItem({ symbol: 'MSFT', sort_order: 0 }),
      createItem({ symbol: 'AAPL', sort_order: 1 })
    ];
    const updateMsftQuery = createQuery({ error: null });
    const updateAaplQuery = createQuery({ error: null });
    const fetchQuery = createQuery({ data: items, error: null });

    mockCreateClient
      .mockResolvedValueOnce(createSupabase(updateMsftQuery, updateAaplQuery))
      .mockResolvedValueOnce(createSupabase(fetchQuery));

    await expect(
      reorderWatchlistItems('user_123', [
        { symbol: 'msft', sort_order: 0 },
        { symbol: 'aapl', sort_order: 1 }
      ])
    ).resolves.toEqual(items);

    expect(updateMsftQuery.update).toHaveBeenCalledWith({ sort_order: 0 });
    expect(updateMsftQuery.eq).toHaveBeenCalledWith('symbol', 'MSFT');
    expect(updateAaplQuery.update).toHaveBeenCalledWith({ sort_order: 1 });
    expect(updateAaplQuery.eq).toHaveBeenCalledWith('symbol', 'AAPL');
  });
});
