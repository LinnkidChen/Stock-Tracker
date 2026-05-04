/**
 * @jest-environment node
 */
import {
  createWatchlistAlert,
  getWatchlistAlertTriggers,
  getWatchlistAlerts,
  recordWatchlistAlertTrigger,
  updateWatchlistAlert
} from './alerts-storage';
import { createClient } from '../supabase/server';

jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}));

const alertRow = {
  id: 'alert-1',
  clerk_user_id: 'user_123',
  symbol: 'aapl',
  alert_type: 'price_above',
  threshold: '150.25',
  status: 'active',
  last_triggered_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

const triggerRow = {
  id: 'trigger-1',
  alert_id: 'alert-1',
  clerk_user_id: 'user_123',
  symbol: 'aapl',
  alert_type: 'price_above',
  threshold: '150.25',
  observed_value: '151.00',
  observed_price: '151.00',
  message: 'AAPL reached $151.00',
  triggered_at: '2026-01-02T00:00:00.000Z'
};

function createQuery(result: unknown) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve(result)),
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

describe('watchlist alert storage', () => {
  const mockCreateClient = createClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches alerts with normalized symbols and numeric thresholds', async () => {
    const query = createQuery({ data: [alertRow], error: null });
    const supabase = createSupabase(query);
    mockCreateClient.mockResolvedValue(supabase);

    await expect(getWatchlistAlerts('user_123')).resolves.toEqual([
      {
        id: 'alert-1',
        symbol: 'AAPL',
        type: 'price_above',
        threshold: 150.25,
        status: 'active',
        lastTriggeredAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);
    expect(supabase.from).toHaveBeenCalledWith('stock_watchlist_alerts');
    expect(query.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
  });

  it('fetches trigger history newest first', async () => {
    const query = createQuery({ data: [triggerRow], error: null });
    mockCreateClient.mockResolvedValue(createSupabase(query));

    await expect(getWatchlistAlertTriggers('user_123')).resolves.toEqual([
      {
        id: 'trigger-1',
        alertId: 'alert-1',
        symbol: 'AAPL',
        type: 'price_above',
        threshold: 150.25,
        observedValue: 151,
        observedPrice: 151,
        message: 'AAPL reached $151.00',
        triggeredAt: '2026-01-02T00:00:00.000Z'
      }
    ]);
    expect(query.order).toHaveBeenCalledWith('triggered_at', {
      ascending: false
    });
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('creates an active alert', async () => {
    const query = createQuery({ data: alertRow, error: null });
    mockCreateClient.mockResolvedValue(createSupabase(query));

    await expect(
      createWatchlistAlert('user_123', {
        symbol: 'aapl',
        type: 'price_above',
        threshold: 150.25
      })
    ).resolves.toMatchObject({
      id: 'alert-1',
      symbol: 'AAPL',
      threshold: 150.25,
      status: 'active'
    });

    expect(query.insert).toHaveBeenCalledWith({
      clerk_user_id: 'user_123',
      symbol: 'AAPL',
      alert_type: 'price_above',
      threshold: 150.25,
      status: 'active'
    });
  });

  it('updates alert status', async () => {
    const query = createQuery({
      data: { ...alertRow, status: 'paused' },
      error: null
    });
    mockCreateClient.mockResolvedValue(createSupabase(query));

    await expect(
      updateWatchlistAlert('user_123', 'alert-1', {
        status: 'paused'
      })
    ).resolves.toMatchObject({
      id: 'alert-1',
      status: 'paused'
    });

    expect(query.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(query.eq).toHaveBeenCalledWith('id', 'alert-1');
  });

  it('records trigger history and marks the alert triggered', async () => {
    const fetchAlertQuery = createQuery({ data: alertRow, error: null });
    const insertTriggerQuery = createQuery({ data: triggerRow, error: null });
    const updateAlertQuery = createQuery({
      data: {
        ...alertRow,
        status: 'triggered',
        last_triggered_at: '2026-01-02T00:00:00.000Z'
      },
      error: null
    });

    mockCreateClient
      .mockResolvedValueOnce(
        createSupabase(fetchAlertQuery, insertTriggerQuery)
      )
      .mockResolvedValueOnce(createSupabase(updateAlertQuery));

    await expect(
      recordWatchlistAlertTrigger('user_123', {
        alertId: 'alert-1',
        observedValue: 151,
        observedPrice: 151,
        message: 'AAPL reached $151.00',
        triggeredAt: '2026-01-02T00:00:00.000Z'
      })
    ).resolves.toMatchObject({
      alert: {
        id: 'alert-1',
        status: 'triggered',
        lastTriggeredAt: '2026-01-02T00:00:00.000Z'
      },
      trigger: {
        id: 'trigger-1',
        observedValue: 151
      }
    });

    expect(insertTriggerQuery.insert).toHaveBeenCalledWith({
      alert_id: 'alert-1',
      clerk_user_id: 'user_123',
      symbol: 'AAPL',
      alert_type: 'price_above',
      threshold: 150.25,
      observed_value: 151,
      observed_price: 151,
      message: 'AAPL reached $151.00',
      triggered_at: '2026-01-02T00:00:00.000Z'
    });
    expect(updateAlertQuery.update).toHaveBeenCalledWith({
      status: 'triggered',
      last_triggered_at: '2026-01-02T00:00:00.000Z'
    });
  });
});
