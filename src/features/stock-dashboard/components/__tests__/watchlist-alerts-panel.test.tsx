/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistAlertsPanel } from '../WatchlistAlertsPanel';
import type { WatchlistAlert } from '@/types/alerts';
import type { WatchlistPricesMap } from '@/types/stocks';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

function createAlert(overrides: Partial<WatchlistAlert>): WatchlistAlert {
  return {
    id: 'alert-1',
    symbol: 'AAPL',
    type: 'price_above',
    threshold: 100,
    status: 'active',
    lastTriggeredAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function alertsResponse(alerts: WatchlistAlert[] = [], triggers: any[] = []) {
  return {
    success: true,
    data: {
      alerts,
      triggers
    }
  };
}

describe('WatchlistAlertsPanel', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates an alert for a watched symbol', async () => {
    let createBody: any = null;
    const createdAlert = createAlert({
      id: 'alert-2',
      threshold: 150
    });

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist/alerts') && !init?.method) {
          return {
            ok: true,
            json: async () => alertsResponse()
          } as any;
        }
        if (url.endsWith('/api/watchlist/alerts') && init?.method === 'POST') {
          createBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { alert: createdAlert }
            })
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    const user = userEvent.setup();
    render(<WatchlistAlertsPanel symbols={['AAPL']} pricesMap={{}} />);

    await screen.findByText('No alerts configured.');
    await user.click(screen.getByRole('button', { name: /new alert/i }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Threshold'), '150');
    await user.click(within(dialog).getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(createBody).toEqual({
        symbol: 'AAPL',
        type: 'price_above',
        threshold: 150
      })
    );
    expect(await screen.findByText(/above \$150\.00/)).toBeInTheDocument();
  });

  it('records trigger history when an active alert crosses its threshold', async () => {
    const initialAlert = createAlert({ threshold: 100 });
    const triggeredAlert = {
      ...initialAlert,
      status: 'triggered',
      lastTriggeredAt: '2026-01-02T00:00:00.000Z'
    };
    const trigger = {
      id: 'trigger-1',
      alertId: initialAlert.id,
      symbol: 'AAPL',
      type: 'price_above',
      threshold: 100,
      observedValue: 101,
      observedPrice: 101,
      message: 'AAPL reached $101.00',
      triggeredAt: '2026-01-02T00:00:00.000Z'
    };
    const pricesMap: WatchlistPricesMap = {
      AAPL: {
        price: 101,
        change: 1,
        changePercent: 1,
        volume: 1_000_000,
        open: 100,
        previousClose: 99,
        avgVolume: 900_000,
        lastUpdated: new Date('2026-01-02T00:00:00.000Z')
      }
    };
    let triggerBody: any = null;

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/watchlist/alerts') && !init?.method) {
          return {
            ok: true,
            json: async () => alertsResponse([initialAlert])
          } as any;
        }
        if (
          url.endsWith('/api/watchlist/alerts/triggers') &&
          init?.method === 'POST'
        ) {
          triggerBody = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                alert: triggeredAlert,
                trigger
              }
            })
          } as any;
        }
        throw new Error('Unexpected URL ' + url);
      }
    ) as any;

    render(<WatchlistAlertsPanel symbols={['AAPL']} pricesMap={pricesMap} />);

    await waitFor(() =>
      expect(triggerBody).toMatchObject({
        alertId: 'alert-1',
        observedValue: 101,
        observedPrice: 101
      })
    );
    expect(await screen.findByText('triggered')).toBeInTheDocument();
    expect(screen.getByText('AAPL reached $101.00')).toBeInTheDocument();
  });
});
