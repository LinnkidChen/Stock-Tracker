/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react';
import { useDashboardStore } from './store';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';

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
      quoteProvider: CANONICAL_QUOTE_PROVIDER
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
});
