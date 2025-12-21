import { create } from 'zustand';

interface DashboardState {
  selectedTicker: string | null;
  loading: boolean;
  wsConnected: boolean;
  lastTickers: string[];
  quoteProvider: string;
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
    // State
    selectedTicker: null,
    loading: false,
    wsConnected: false,
    lastTickers: [],
    quoteProvider: 'default',

    // Actions
    setSelectedTicker: (ticker: string) => {
      set({ selectedTicker: ticker });
      get().addToLastTickers(ticker);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('dashboard:selectedTicker', ticker);
      }
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
        localStorage.setItem('dashboard:lastTickers', JSON.stringify(updated));
      }
    },

    setQuoteProvider: (provider: string) => {
      set({ quoteProvider: provider });
      if (typeof window !== 'undefined') {
        localStorage.setItem('dashboard:quoteProvider', provider);
      }
    },

    hydrateFromStorage: () => {
      if (typeof window === 'undefined') return;

      const selectedTicker = sessionStorage.getItem('dashboard:selectedTicker');
      const lastTickers = localStorage.getItem('dashboard:lastTickers');
      const quoteProvider = localStorage.getItem('dashboard:quoteProvider');

      if (selectedTicker) {
        set({ selectedTicker });
      }

      if (lastTickers) {
        try {
          set({ lastTickers: JSON.parse(lastTickers) });
        } catch {
          // Ignore invalid JSON
        }
      }

      if (quoteProvider) {
        set({ quoteProvider });
      }
    }
  })
);
