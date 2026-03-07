/**
 * @jest-environment node
 */
import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
} from '@/lib/watchlist/storage';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/watchlist/storage', () => ({
  getWatchlist: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn()
}));

describe('/api/watchlist', () => {
  const mockAuth = auth as jest.Mock;
  const mockGet = getWatchlist as jest.Mock;
  const mockAdd = addToWatchlist as jest.Mock;
  const mockRemove = removeFromWatchlist as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const req = new NextRequest('http://localhost/api/watchlist');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns watchlist if user is authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGet.mockResolvedValue(['AAPL', 'MSFT']);

      const req = new NextRequest('http://localhost/api/watchlist');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['AAPL', 'MSFT']);
      expect(mockGet).toHaveBeenCalledWith('user_123');
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

    it('adds symbol to watchlist', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockAdd.mockResolvedValue(['AAPL']);

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', symbol: 'AAPL' })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['AAPL']);
      expect(mockAdd).toHaveBeenCalledWith('user_123', 'AAPL');
    });

    it('removes symbol from watchlist', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockRemove.mockResolvedValue(['MSFT']); // assume AAPL removed, MSFT remains

      const req = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove', symbol: 'AAPL' })
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.watchlist).toEqual(['MSFT']);
      expect(json.data.watchlist).toEqual(['MSFT']);
      expect(mockRemove).toHaveBeenCalledWith('user_123', 'AAPL');
    });

    it('returns 500 if storage fails', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      const error = new Error('Database error');
      mockAdd.mockRejectedValue(error);

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

  describe('misconfiguration handling', () => {
    it('returns 503 on GET if watchlist auth is misconfigured', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' });
      mockGet.mockRejectedValue(
        new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured'
        )
      );

      const req = new NextRequest('http://localhost/api/watchlist');
      const res = await GET(req);
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
