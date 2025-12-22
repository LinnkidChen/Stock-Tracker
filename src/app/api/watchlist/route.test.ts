/**
 * @jest-environment node
 */
import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

// Mock rate limiting to avoid interference?
// The current route.ts has internal rate limiting.
// Ideally we should mock the internal functions or just accept it works.
// Since we are rewriting route.ts, we will need to handle how we test it.
// For now, let's assume valid requests.

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
      // Currently the route might not check auth, but our plan says it should.
      // So this test expects the new behavior.
      // If we run this now against OLD implementation, it might fail or pass depending on existing code.
      // Existing code uses IP for rate limit but doesn't strictly check auth for logic?
      // Actually existing code just uses "anonymous" if no IP?
      // Existing code does NOT check auth() from Clerk. So this will fail until we implement T009.
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
  });
});
