/**
 * @jest-environment node
 */
import { DELETE, GET, PATCH, POST } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  createWatchlistAlert,
  deleteWatchlistAlert,
  getWatchlistAlerts,
  getWatchlistAlertTriggers,
  updateWatchlistAlert,
  WatchlistAlertNotFoundError
} from '@/lib/watchlist/alerts-storage';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/watchlist/alerts-storage', () => ({
  createWatchlistAlert: jest.fn(),
  deleteWatchlistAlert: jest.fn(),
  getWatchlistAlerts: jest.fn(),
  getWatchlistAlertTriggers: jest.fn(),
  updateWatchlistAlert: jest.fn(),
  WatchlistAlertNotFoundError: class WatchlistAlertNotFoundError extends Error {}
}));

const alert = {
  id: 'alert-1',
  symbol: 'AAPL',
  type: 'price_above',
  threshold: 150,
  status: 'active',
  lastTriggeredAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const trigger = {
  id: 'trigger-1',
  alertId: 'alert-1',
  symbol: 'AAPL',
  type: 'price_above',
  threshold: 150,
  observedValue: 151,
  observedPrice: 151,
  message: 'AAPL reached $151.00',
  triggeredAt: '2026-01-02T00:00:00.000Z'
};

describe('/api/watchlist/alerts', () => {
  const mockAuth = auth as jest.Mock;
  const mockGetAlerts = getWatchlistAlerts as jest.Mock;
  const mockGetTriggers = getWatchlistAlertTriggers as jest.Mock;
  const mockCreate = createWatchlistAlert as jest.Mock;
  const mockUpdate = updateWatchlistAlert as jest.Mock;
  const mockDelete = deleteWatchlistAlert as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns alert definitions and trigger history', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetAlerts.mockResolvedValue([alert]);
    mockGetTriggers.mockResolvedValue([trigger]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.alerts).toEqual([alert]);
    expect(json.data.triggers).toEqual([trigger]);
    expect(mockGetAlerts).toHaveBeenCalledWith('user_123');
    expect(mockGetTriggers).toHaveBeenCalledWith('user_123');
  });

  it('creates an alert with normalized symbol', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockCreate.mockResolvedValue(alert);

    const req = new NextRequest('http://localhost/api/watchlist/alerts', {
      method: 'POST',
      body: JSON.stringify({
        symbol: 'aapl',
        type: 'price_above',
        threshold: '150'
      })
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.alert).toEqual(alert);
    expect(mockCreate).toHaveBeenCalledWith('user_123', {
      symbol: 'AAPL',
      type: 'price_above',
      threshold: 150
    });
  });

  it('rejects invalid volume spike thresholds', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const req = new NextRequest('http://localhost/api/watchlist/alerts', {
      method: 'POST',
      body: JSON.stringify({
        symbol: 'AAPL',
        type: 'volume_spike',
        threshold: 0.5
      })
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toBe(
      'Volume spike multiplier must be at least 1'
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('updates alert status', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockUpdate.mockResolvedValue({ ...alert, status: 'paused' });

    const req = new NextRequest('http://localhost/api/watchlist/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'alert-1', status: 'paused' })
    });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.alert.status).toBe('paused');
    expect(mockUpdate).toHaveBeenCalledWith('user_123', 'alert-1', {
      status: 'paused'
    });
  });

  it('returns 404 when deleting a missing alert', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDelete.mockRejectedValue(new WatchlistAlertNotFoundError());

    const req = new NextRequest(
      'http://localhost/api/watchlist/alerts?id=alert-1',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.message).toBe('Watchlist alert not found');
  });
});
