import { create } from 'zustand';
import * as Sentry from '@sentry/nextjs';
import {
  CANONICAL_QUOTE_PROVIDER,
  type CanonicalQuoteProvider,
  migrateStoredQuoteProvider
} from '@/lib/providers/config';
import {
  CHART_WORKSPACE_STORAGE_KEY,
  DEFAULT_CHART_WORKSPACE,
  mergeChartPreferences,
  parseChartWorkspace,
  type ChartPreferencesPatch,
  type ChartWorkspace
} from './lib/chart-workspace';

const LAST_TICKERS_STORAGE_KEY = 'dashboard:lastTickers';
const QUOTE_PROVIDER_STORAGE_KEY = 'dashboard:quoteProvider';
const SELECTED_TICKER_STORAGE_KEY = 'dashboard:selectedTicker';

interface DashboardState {
  selectedTicker: string | null;
  loading: boolean;
  wsConnected: boolean;
  lastTickers: string[];
  quoteProvider: CanonicalQuoteProvider;
  chartWorkspace: ChartWorkspace;
}

interface DashboardActions {
  setSelectedTicker: (ticker: string) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  addToLastTickers: (ticker: string) => void;
  setQuoteProvider: (provider: string) => void;
  setChartWorkspace: (workspace: Partial<ChartWorkspace>) => void;
  setChartPreferences: (preferences: ChartPreferencesPatch) => void;
  hydrateFromStorage: () => void;
}

function persistChartWorkspace(chartWorkspace: ChartWorkspace) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      CHART_WORKSPACE_STORAGE_KEY,
      JSON.stringify(chartWorkspace)
    );
  } catch {
    // Ignore unavailable storage in private browsing or quota failures.
  }
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  (set, get) => ({
    selectedTicker: null,
    loading: false,
    wsConnected: false,
    lastTickers: [],
    quoteProvider: CANONICAL_QUOTE_PROVIDER,
    chartWorkspace: DEFAULT_CHART_WORKSPACE,

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
        localStorage.setItem(LAST_TICKERS_STORAGE_KEY, JSON.stringify(updated));
      }
    },

    setQuoteProvider: (provider: string) => {
      const nextProvider = migrateStoredQuoteProvider(provider);

      set({ quoteProvider: nextProvider });

      if (typeof window !== 'undefined') {
        localStorage.setItem(QUOTE_PROVIDER_STORAGE_KEY, nextProvider);
      }
    },

    setChartWorkspace: (workspace: Partial<ChartWorkspace>) => {
      const current = get().chartWorkspace;
      const nextWorkspace = {
        ...current,
        ...workspace,
        preferences: workspace.preferences
          ? mergeChartPreferences(current.preferences, workspace.preferences)
          : current.preferences
      };

      set({ chartWorkspace: nextWorkspace });
      persistChartWorkspace(nextWorkspace);
    },

    setChartPreferences: (preferences: ChartPreferencesPatch) => {
      const current = get().chartWorkspace;
      const nextWorkspace = {
        ...current,
        preferences: mergeChartPreferences(current.preferences, preferences)
      };

      set({ chartWorkspace: nextWorkspace });
      persistChartWorkspace(nextWorkspace);
    },

    hydrateFromStorage: () => {
      if (typeof window === 'undefined') return;

      const selectedTicker = sessionStorage.getItem(
        SELECTED_TICKER_STORAGE_KEY
      );
      const lastTickers = localStorage.getItem(LAST_TICKERS_STORAGE_KEY);
      const quoteProvider = localStorage.getItem(QUOTE_PROVIDER_STORAGE_KEY);
      const chartWorkspace = localStorage.getItem(CHART_WORKSPACE_STORAGE_KEY);

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

      set({ chartWorkspace: parseChartWorkspace(chartWorkspace) });
    }
  })
);
