# Type Safety

The repo uses TypeScript with shared domain types under `src/types` and `src/lib/types`. Keep frontend types close to the data source and avoid broad escape hatches.

## Shared Type Sources

Use existing shared types before creating new local interfaces:

- Stock API types: `src/lib/types/stock-api.ts`
- App/domain types: `src/types/stocks.ts`, `src/types/watchlist.ts`, `src/types/portfolio.ts`
- Provider config types: `src/lib/providers/config.ts`
- Feature types for chart workspace and preferences: `src/features/stock-dashboard/lib/chart-workspace.ts`

Examples:

```typescript
import {
  DEFAULT_KLINE_INTERVAL,
  type KLineInterval,
  KLineSeries
} from '@/lib/types/stock-api';
import type { WatchlistItem as ApiWatchlistItem } from '@/types/watchlist';
import { WatchlistItemWithPrice } from '@/types/stocks';
```

## Runtime Validation

Validate user input and stale browser data through helpers instead of assuming shape:

- `normalizeTicker` and `validateTicker` in `src/lib/validation/ticker.ts`.
- `parseChartWorkspace` and `mergeChartPreferences` in `src/features/stock-dashboard/lib/chart-workspace.ts`.
- API response parsing through `readStockApiResponse`.

Example:

```typescript
const res = validateTicker(ticker);
if (!res.isValid) {
  setError(res.error ?? 'Invalid symbol');
  return;
}

const sym = normalizeTicker(ticker);
```

## API Responses

Use typed response helpers and explicit union shapes for ad hoc endpoint responses.

Example from `WatchlistCard`:

```typescript
type WatchlistMutationResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      status?: number;
      message?: string;
      error?: unknown;
      code?: string;
    };
```

When normalizing uncertain JSON, prefer small typed functions. The current code has one known exception in `getResponseItems(json: any)`. Do not copy that pattern into new code; use `unknown` plus guards or a schema when touching this area.

## React Query And Hooks

Return explicit interfaces from hooks with composed state:

```typescript
export interface UseWatchlistPricesResult {
  pricesMap: WatchlistPricesMap;
  isLoading: boolean;
  isRefreshing: boolean;
  hasErrors: boolean;
  errorSymbols: string[];
  staleSymbols: string[];
  lastRefreshedAt: Date | null;
  refreshAll: () => Promise<void>;
  refetch: () => Promise<void>;
}
```

For optional query inputs, guard execution with `enabled` and keep the non-null assertion localized inside the `queryFn`.

## Props And Component APIs

Use explicit prop interfaces when the component is exported and accepts custom props:

```typescript
interface TickerInputProps {
  onTickerSubmit?: (ticker: string) => void;
}
```

Inline prop types are acceptable for tiny one-off components, as in `DashboardClient`:

```typescript
export function DashboardClient({
  diagnostics
}: {
  diagnostics?: SetupDiagnostics;
}) {
  // ...
}
```

## Tests

Tests may use casts around mocked browser globals or fetch where the testing library/Jest types make the mock cumbersome. Keep those casts in test files only.

Example pattern:

```typescript
const originalFetch = global.fetch as any;
global.fetch = jest.fn() as any;
```

New production code should not add `any`, `@ts-ignore`, or `@ts-expect-error`.

## Avoid

- Redefining a domain type that already exists in `src/types` or `src/lib/types`.
- Using `any` in production code for API JSON, React Query cache data, or component props.
- Blind type assertions for data from browser storage, APIs, or user input.
- Letting tests drive production types toward weaker shapes.
