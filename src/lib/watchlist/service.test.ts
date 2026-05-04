import {
  addToWatchlist,
  getWatchlistItems,
  removeFromWatchlist,
  reorderWatchlistItems,
  updateWatchlistItemMetadata
} from './storage';
import {
  applyWatchlistMutation,
  applyWatchlistPatch,
  createWatchlistPayload,
  getWatchlistForUser
} from './service';
import type { WatchlistItem } from '@/types/watchlist';

jest.mock('./storage', () => ({
  addToWatchlist: jest.fn(),
  getWatchlistItems: jest.fn(),
  removeFromWatchlist: jest.fn(),
  reorderWatchlistItems: jest.fn(),
  updateWatchlistItemMetadata: jest.fn()
}));

function item(symbol: string): WatchlistItem {
  return {
    id: `item-${symbol}`,
    symbol,
    exchange: null,
    note: null,
    sort_order: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };
}

describe('watchlist service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the stable route payload shape', () => {
    expect(createWatchlistPayload([item('AAPL'), item('MSFT')])).toEqual({
      watchlist: ['AAPL', 'MSFT'],
      items: [item('AAPL'), item('MSFT')]
    });
  });

  it('fetches items through storage', async () => {
    const items = [item('AAPL')];
    (getWatchlistItems as jest.Mock).mockResolvedValue(items);

    await expect(getWatchlistForUser('user_123')).resolves.toEqual(items);
    expect(getWatchlistItems).toHaveBeenCalledWith('user_123');
  });

  it('applies add and remove mutations', async () => {
    (addToWatchlist as jest.Mock).mockResolvedValue([item('AAPL')]);
    (removeFromWatchlist as jest.Mock).mockResolvedValue([]);

    await applyWatchlistMutation('user_123', {
      action: 'add',
      symbol: 'AAPL',
      metadata: { exchange: 'NASDAQ', note: null }
    });
    await applyWatchlistMutation('user_123', {
      action: 'remove',
      symbol: 'AAPL'
    });

    expect(addToWatchlist).toHaveBeenCalledWith('user_123', 'AAPL', {
      exchange: 'NASDAQ',
      note: null
    });
    expect(removeFromWatchlist).toHaveBeenCalledWith('user_123', 'AAPL');
  });

  it('applies metadata and reorder patches', async () => {
    (updateWatchlistItemMetadata as jest.Mock).mockResolvedValue([
      item('AAPL')
    ]);
    (reorderWatchlistItems as jest.Mock).mockResolvedValue([item('AAPL')]);

    await applyWatchlistPatch('user_123', {
      action: 'update',
      symbol: 'AAPL',
      metadata: { exchange: 'NYSE', note: 'Dividend' }
    });
    await applyWatchlistPatch('user_123', {
      action: 'reorder',
      items: [{ symbol: 'AAPL', sort_order: 0 }]
    });

    expect(updateWatchlistItemMetadata).toHaveBeenCalledWith(
      'user_123',
      'AAPL',
      {
        exchange: 'NYSE',
        note: 'Dividend'
      }
    );
    expect(reorderWatchlistItems).toHaveBeenCalledWith('user_123', [
      { symbol: 'AAPL', sort_order: 0 }
    ]);
  });
});
