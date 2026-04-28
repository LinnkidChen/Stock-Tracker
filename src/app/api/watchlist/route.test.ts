/**
 * @jest-environment node
 */
import { POST, GET, PATCH } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  getWatchlistItems,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistItemMetadata,
  reorderWatchlistItems
} from '@/lib/watchlist/storage';
import type { WatchlistItem } from '@/types/watchlist';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/watchlist/storage', () => ({
  getWatchlistItems: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
  updateWatchlistItemMetadata: jest.fn(),
  reorderWatchlistItems: jest.fn()
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

describe('/api/watchlist', () => {
  const mockAuth = auth as jest.Mock;
  const mockGetItems = getWatchlistItems as jest.Mock;
  const mockAdd = addToWatchlist as jest.Mock;
  const mockRemove = removeFromWatchlist as jest.Mock;
  const mockUpdate = updateWatchlistItemMetadata as jest.Mock;
  const mockReorder = reorderWatchlistItems as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns watchlist symbols and item metadata if user is authenticated', async () => {
      const items = [
        createItem({ id: 'item-1', symbol: 'AAPL', exchange: 'NASDAQ' }),
        createItem({ id: 'item-2', symbol: 'MSFT', note: 'AI' })
      ];

      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGetItems.mockResolvedValue(items);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['AAPL', 'MSFT']);
      expect(json.data.items).toEqual(items);
      expect(mockGetItems).toHaveBeenCalledWith('user_123');
    });
  });

  describe('POST', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', symbol: 'AAPL' })
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('adds symbol with normalized metadata', async () => {
      const items = [
        createItem({
          symbol: 'AAPL',
          exchange: 'NASDAQ',
          note: 'Core holding'
        })
      ];

      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockResolvedValue(items);

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          symbol: 'aapl',
          exchange: ' nasdaq ',
          note: ' Core holding '
        })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['AAPL']);
      expect(json.data.items).toEqual(items);
      expect(mockAdd).toHaveBeenCalledWith('user_123', 'AAPL', {
        exchange: 'NASDAQ',
        note: 'Core holding'
      });
    });

    it('removes symbol from watchlist', async () => {
      const items = [createItem({ id: 'item-2', symbol: 'MSFT' })];

      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockRemove.mockResolvedValue(items);

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove', symbol: 'AAPL' })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['MSFT']);
      expect(json.data.items).toEqual(items);
      expect(mockRemove).toHaveBeenCalledWith('user_123', 'AAPL');
    });

    it('returns 400 if note exceeds 500 characters', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          symbol: 'AAPL',
          note: 'a'.repeat(501)
        })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Note must be 500 characters or less');
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('returns 500 if storage fails', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockRejectedValue(new Error('Database error'));

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', symbol: 'fail' })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('returns 503 if watchlist auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', symbol: 'AAPL' })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).toBe(false);
      expect(json.error).toEqual({
        code: 'WATCHLIST_AUTH_MISCONFIGURED',
        message: 'Watchlist authentication is not configured on the server.'
      });
    });
  });

  describe('PATCH', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'update', symbol: 'AAPL' })
      });
      const res = await PATCH(req);
      expect(res.status).toBe(401);
    });

    it('updates item metadata', async () => {
      const items = [
        createItem({ symbol: 'AAPL', exchange: 'NYSE', note: 'Dividend' })
      ];

      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockResolvedValue(items);

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'update',
          symbol: 'aapl',
          exchange: ' nyse ',
          note: ' Dividend '
        })
      });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.watchlist).toEqual(['AAPL']);
      expect(json.data.items).toEqual(items);
      expect(mockUpdate).toHaveBeenCalledWith('user_123', 'AAPL', {
        exchange: 'NYSE',
        note: 'Dividend'
      });
    });

    it('persists reorder items', async () => {
      const items = [
        createItem({ symbol: 'MSFT', sort_order: 0 }),
        createItem({ symbol: 'AAPL', sort_order: 1 })
      ];

      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockReorder.mockResolvedValue(items);

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reorder',
          items: [
            { symbol: 'msft', sort_order: 0 },
            { symbol: 'aapl', sort_order: 1 }
          ]
        })
      });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.watchlist).toEqual(['MSFT', 'AAPL']);
      expect(mockReorder).toHaveBeenCalledWith('user_123', [
        { symbol: 'MSFT', sort_order: 0 },
        { symbol: 'AAPL', sort_order: 1 }
      ]);
    });

    it('rejects invalid reorder sort_order values', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reorder',
          items: [{ symbol: 'AAPL', sort_order: -1 }]
        })
      });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toBe(
        'sort_order must be a non-negative safe integer'
      );
      expect(mockReorder).not.toHaveBeenCalled();
    });

    it('returns 503 if patch storage auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockUpdate.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'update', symbol: 'AAPL' })
      });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).toBe(false);
      expect(json.error).toEqual({
        code: 'WATCHLIST_AUTH_MISCONFIGURED',
        message: 'Watchlist authentication is not configured on the server.'
      });
    });
  });

  describe('misconfiguration handling', () => {
    it('returns 503 on GET if watchlist auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGetItems.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).toBe(false);
      expect(json.error).toEqual({
        code: 'WATCHLIST_AUTH_MISCONFIGURED',
        message: 'Watchlist authentication is not configured on the server.'
      });
    });
  });
});
