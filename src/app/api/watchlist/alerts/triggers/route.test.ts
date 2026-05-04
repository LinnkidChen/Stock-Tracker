/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { recordWatchlistAlertTrigger } from '@/lib/watchlist/alerts-storage';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/watchlist/alerts-storage', () => ({
  recordWatchlistAlertTrigger: jest.fn(),
  WatchlistAlertNotActiveError: class WatchlistAlertNotActiveError extends Error {},
  WatchlistAlertNotFoundError: class WatchlistAlertNotFoundError extends Error {}
}));

describe('/api/watchlist/alerts/triggers', () => {
  const mockAuth = auth as jest.Mock;
  const mockRecord = recordWatchlistAlertTrigger as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a trigger for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockRecord.mockResolvedValue({
      alert: { id: 'alert-1', status: 'triggered' },
      trigger: { id: 'trigger-1' }
    });

    const req = new NextRequest(
      'http://localhost/api/watchlist/alerts/triggers',
      {
        method: 'POST',
        body: JSON.stringify({
          alertId: 'alert-1',
          observedValue: 151,
          observedPrice: 151,
          message: 'AAPL reached $151.00',
          triggeredAt: '2026-01-02T00:00:00.000Z'
        })
      }
    );
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockRecord).toHaveBeenCalledWith('user_123', {
      alertId: 'alert-1',
      observedValue: 151,
      observedPrice: 151,
      message: 'AAPL reached $151.00',
      triggeredAt: '2026-01-02T00:00:00.000Z'
    });
  });

  it('rejects invalid observed values', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const req = new NextRequest(
      'http://localhost/api/watchlist/alerts/triggers',
      {
        method: 'POST',
        body: JSON.stringify({
          alertId: 'alert-1',
          observedValue: 'not-a-number',
          message: 'AAPL reached target'
        })
      }
    );
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toBe('observedValue must be a finite number');
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
