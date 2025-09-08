import { create } from 'zustand';

interface DashboardState {
  selectedTicker: string | null;
  loading: boolean;
  wsConnected: boolean;
  lastTickers: string[];
}

interface DashboardActions {
  setSelectedTicker: (ticker: string) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  addToLastTickers: (ticker: string) => void;
  hydrateFromStorage: () => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  (set, get) => ({
    // State
    selectedTicker: null,
    loading: false,
    wsConnected: false,
    lastTickers: [],

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

    hydrateFromStorage: () => {
      if (typeof window === 'undefined') return;

      const selectedTicker = sessionStorage.getItem('dashboard:selectedTicker');
      const lastTickers = localStorage.getItem('dashboard:lastTickers');

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
    }
  })
);
