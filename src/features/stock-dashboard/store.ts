import { create } from 'zustand';
import * as Sentry from '@sentry/nextjs';
import {
  CANONICAL_QUOTE_PROVIDER,
  type CanonicalQuoteProvider,
  migrateStoredQuoteProvider
} from '@/lib/providers/config';

const LAST_TICKERS_STORAGE_KEY = 'dashboard:lastTickers';
const QUOTE_PROVIDER_STORAGE_KEY = 'dashboard:quoteProvider';
const SELECTED_TICKER_STORAGE_KEY = 'dashboard:selectedTicker';

interface DashboardState {
  selectedTicker: string | null;
  loading: boolean;
  wsConnected: boolean;
  lastTickers: string[];
  quoteProvider: CanonicalQuoteProvider;
}

interface DashboardActions {
  setSelectedTicker: (ticker: string) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  addToLastTickers: (ticker: string) => void;
  setQuoteProvider: (provider: string) => void;
  hydrateFromStorage: () => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  (set, get) => ({
    selectedTicker: null,
    loading: false,
    wsConnected: false,
    lastTickers: [],
    quoteProvider: CANONICAL_QUOTE_PROVIDER,

    setSelectedTicker: (ticker: string) => {
      const previousTicker = get().selectedTicker;

      Sentry.startSpan({ op: 'ui.action', name: 'Ticker Switch' }, (span) => {
        span.setAttribute('ticker', ticker);
        if (previousTicker) {
          span.setAttribute('previousTicker', previousTicker);
        }

        set({ selectedTicker: ticker });
        get().addToLastTickers(ticker);

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SELECTED_TICKER_STORAGE_KEY, ticker);
        }
      });
    },

    setLoading: (loading: boolean) => set({ loading }),

    setWsConnected: (connected: boolean) => set({ wsConnected: connected }),

    addToLastTickers: (ticker: string) => {
      const { lastTickers } = get();
      const updated = [
        ticker,
        ...lastTickers.filter((t) => t !== ticker)
      ].slice(0, 5);

      set({ lastTickers: updated });

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          LAST_TICKERS_STORAGE_KEY,
          JSON.stringify(updated)
        );
      }
    },

    setQuoteProvider: (provider: string) => {
      const nextProvider = migrateStoredQuoteProvider(provider);

      set({ quoteProvider: nextProvider });

      if (typeof window !== 'undefined') {
        localStorage.setItem(QUOTE_PROVIDER_STORAGE_KEY, nextProvider);
      }
    },

    hydrateFromStorage: () => {
      if (typeof window === 'undefined') return;

      const selectedTicker = sessionStorage.getItem(SELECTED_TICKER_STORAGE_KEY);
      const lastTickers = localStorage.getItem(LAST_TICKERS_STORAGE_KEY);
      const quoteProvider = localStorage.getItem(QUOTE_PROVIDER_STORAGE_KEY);

      if (selectedTicker) {
        set({ selectedTicker });
      }

      if (lastTickers) {
        try {
          set({ lastTickers: JSON.parse(lastTickers) });
        } catch {
          // Ignore invalid JSON from stale storage.
        }
      }

      if (quoteProvider) {
        const migratedProvider = migrateStoredQuoteProvider(quoteProvider);
        set({ quoteProvider: migratedProvider });

        if (quoteProvider !== migratedProvider) {
          localStorage.setItem(QUOTE_PROVIDER_STORAGE_KEY, migratedProvider);
        }
      }
    }
  })
);
