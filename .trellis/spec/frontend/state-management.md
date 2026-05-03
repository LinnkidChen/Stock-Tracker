# State Management

This app uses a mix of Zustand, React Query, local component state, session/local storage, and limited URL state utilities.

## Current Tools

| State kind | Current tool | Examples |
| --- | --- | --- |
| Server/API data | TanStack Query | `useKlineSeries`, `useWatchlistPrices`, component tests with `QueryClientProvider` |
| Feature UI/session preferences | Zustand | `src/features/stock-dashboard/store.ts` |
| Browser persistence | `localStorage` / `sessionStorage` behind guards | last tickers, quote provider, selected ticker, chart workspace |
| Local form/dialog state | `useState` | `TickerInput`, `WatchlistCard` |
| URL/search params | `nuqs` utilities and `src/lib/searchparams.ts` where already used | data table/search param helpers |

Do not introduce a new state library without a separate design decision.

## Zustand Store Pattern

Feature stores live with the feature. The dashboard store exports one hook, combines state and actions, and keeps persistence logic inside the store.

Example from `src/features/stock-dashboard/store.ts`:

```typescript
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
  hydrateFromStorage: () => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  (set, get) => ({
    selectedTicker: null,
    loading: false,
    wsConnected: false,
    lastTickers: [],
    quoteProvider: CANONICAL_QUOTE_PROVIDER,
    chartWorkspace: DEFAULT_CHART_WORKSPACE,
    hydrateFromStorage: () => {
      if (typeof window === 'undefined') return;
      // storage reads
    }
  })
);
```

When adding store persistence:

- Guard all browser storage with `typeof window !== 'undefined'`.
- Parse stored JSON through a helper where data can be stale or malformed.
- Ignore unavailable storage for non-critical preferences.
- Migrate stored values when canonical config changes, as `migrateStoredQuoteProvider` does.

## Hydration

Hydrate browser-only state from a client component effect. `DashboardClient` calls `hydrateFromStorage()` once after mount:

```typescript
const { hydrateFromStorage } = useDashboardStore();

useEffect(() => {
  hydrateFromStorage();
}, [hydrateFromStorage]);
```

Do not read `window`, `localStorage`, or `sessionStorage` during server render.

## React Query State

Use React Query for API data and freshness. Do not copy fetched data into Zustand unless the feature explicitly needs a durable user preference or cross-screen UI state.

Conventions:

- Include all query inputs in the query key.
- Use `enabled` for optional inputs.
- Use `staleTime`, `refetchInterval`, and retry policies where the feature has freshness expectations.
- Merge websocket/stream data with HTTP data in the hook, not in multiple components.

## Component State

Use local `useState` for transient form and dialog state. Existing examples:

- `TickerInput` keeps input value, validation error, focus state, suggestion query, and debounce state locally.
- `WatchlistCard` keeps edit dialog state, busy flags, retry count, and auto-refresh UI state locally.

Only lift state into Zustand when multiple feature components need the same state or it must survive navigation/refresh.

## URL State

The repo has `nuqs` and search-param helpers, but the stock dashboard mainly uses local and store state today. Prefer URL state only for shareable state such as table filters, pagination, selected tabs, or search terms. Do not move dashboard persistence into URL state unless product behavior calls for shareable links.

## Avoid

- Storing server responses in Zustand when React Query already owns them.
- Reading browser storage without a server guard.
- Duplicating the same state in component state, Zustand, and URL params.
- Making `src/components/ui` primitives depend on app stores.
