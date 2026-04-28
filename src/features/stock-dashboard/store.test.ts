/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react';
import { useDashboardStore } from './store';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';
import {
  CHART_WORKSPACE_STORAGE_KEY,
  DEFAULT_CHART_INDICATORS,
  DEFAULT_CHART_WORKSPACE
} from './lib/chart-workspace';

const removedProvider = ['alpha', 'vantage'].join('');

describe('dashboard provider state', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.setState({
      selectedTicker: null,
      loading: false,
      wsConnected: false,
      lastTickers: [],
      quoteProvider: CANONICAL_QUOTE_PROVIDER,
      chartWorkspace: DEFAULT_CHART_WORKSPACE
    });
  });

  it('hydrates the legacy default alias into the canonical provider value', () => {
    localStorage.setItem('dashboard:quoteProvider', 'default');

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().quoteProvider).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
    expect(localStorage.getItem('dashboard:quoteProvider')).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('migrates removed provider values to Longbridge', () => {
    localStorage.setItem('dashboard:quoteProvider', removedProvider);

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().quoteProvider).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
    expect(localStorage.getItem('dashboard:quoteProvider')).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('canonicalizes provider updates before persisting', () => {
    act(() => {
      useDashboardStore.getState().setQuoteProvider('default');
    });

    expect(useDashboardStore.getState().quoteProvider).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
    expect(localStorage.getItem('dashboard:quoteProvider')).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('hydrates a legacy persisted chart workspace without indicators', () => {
    localStorage.setItem(
      CHART_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        symbol: 'msft',
        interval: 'week',
        range: '3m',
        preferences: {
          showVolume: false,
          showGrid: true,
          candleType: 'area'
        }
      })
    );

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().chartWorkspace).toEqual({
      symbol: 'MSFT',
      interval: 'week',
      range: '3m',
      preferences: {
        showVolume: false,
        showGrid: true,
        candleType: 'area',
        indicators: DEFAULT_CHART_INDICATORS
      }
    });
  });

  it('hydrates valid persisted chart indicators', () => {
    localStorage.setItem(
      CHART_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        symbol: 'AAPL',
        interval: 'day',
        range: '1y',
        preferences: {
          showVolume: true,
          showGrid: true,
          candleType: 'candle_solid',
          indicators: {
            MA: true,
            EMA: false,
            VWAP: true,
            RSI: false,
            MACD: true,
            BOLL: false
          }
        }
      })
    );

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().chartWorkspace.preferences.indicators).toEqual({
      ...DEFAULT_CHART_INDICATORS,
      MA: true,
      VWAP: true,
      MACD: true
    });
  });

  it('falls back to chart workspace defaults for malformed storage', () => {
    localStorage.setItem(CHART_WORKSPACE_STORAGE_KEY, '{bad json');

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().chartWorkspace).toEqual(
      DEFAULT_CHART_WORKSPACE
    );
  });

  it('ignores invalid chart workspace enum values during hydration', () => {
    localStorage.setItem(
      CHART_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        symbol: '',
        interval: 'quarter',
        range: '10y',
        preferences: {
          showVolume: 'yes',
          showGrid: false,
          candleType: 'renko',
          indicators: {
            MA: 'yes',
            EMA: true,
            UNKNOWN: true
          }
        }
      })
    );

    act(() => {
      useDashboardStore.getState().hydrateFromStorage();
    });

    expect(useDashboardStore.getState().chartWorkspace).toEqual({
      ...DEFAULT_CHART_WORKSPACE,
      preferences: {
        ...DEFAULT_CHART_WORKSPACE.preferences,
        showGrid: false,
        indicators: {
          ...DEFAULT_CHART_INDICATORS,
          EMA: true
        }
      }
    });
  });

  it('persists chart workspace updates with minimal fields', () => {
    act(() => {
      useDashboardStore.getState().setChartWorkspace({
        symbol: 'NVDA',
        interval: 'month',
        range: '6m'
      });
      useDashboardStore.getState().setChartPreferences({
        showVolume: false,
        candleType: 'ohlc',
        indicators: {
          ...DEFAULT_CHART_INDICATORS,
          MA: true,
          RSI: true
        }
      });
    });

    expect(JSON.parse(localStorage.getItem(CHART_WORKSPACE_STORAGE_KEY)!)).toEqual({
      symbol: 'NVDA',
      interval: 'month',
      range: '6m',
      preferences: {
        showVolume: false,
        showGrid: true,
        candleType: 'ohlc',
        indicators: {
          ...DEFAULT_CHART_INDICATORS,
          MA: true,
          RSI: true
        }
      }
    });
  });
});
