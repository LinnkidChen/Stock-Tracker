# Hook Guidelines

Hooks are either shared generic utilities in `src/hooks` or feature-specific hooks under `src/features/<feature>/hooks`.

## Placement

- Put reusable UI/mechanics hooks in `src/hooks`, such as `use-debounce.tsx`, `use-media-query.ts`, `use-controllable-state.tsx`, and `use-data-table.ts`.
- Put dashboard data and real-time hooks in `src/features/stock-dashboard/hooks`, such as `useKlineSeries.ts`, `useStockQuote.ts`, `useWatchlistPrices.ts`, and `usePriceStream.ts`.
- Keep hook tests in `hooks/__tests__/` when testing React behavior.

## React Query Hooks

The project uses TanStack Query for browser-side API data. Existing hooks call local Next.js API routes with `fetch`, not oRPC.

Use stable query keys that include every input affecting the result:

```typescript
export function useKlineSeries(
  symbol?: string,
  interval: KLineInterval = DEFAULT_KLINE_INTERVAL,
  provider: string = CANONICAL_QUOTE_PROVIDER
) {
  const query = useQuery({
    queryKey: ['kline-series', symbol, provider, interval],
    queryFn: () => fetchKlineSeries(symbol!, interval, provider),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: false as const
  });

  const noData =
    !!symbol &&
    !query.isLoading &&
    !query.isError &&
    (query.data?.candles.length ?? 0) === 0;

  return { ...query, noData };
}
```

When a query depends on an optional input, use `enabled` to prevent invalid calls. The codebase currently uses `symbol!` inside `queryFn` after guarding with `enabled: !!symbol`.

## Fetch Helpers

Keep network details in an unexported async helper above the hook when the logic is specific to that hook.

Existing conventions:

- Build query strings with `URLSearchParams`.
- Use `AbortController` and a 10s timeout for stock API requests.
- Parse responses through feature helpers such as `readStockApiResponse`.
- Capture known failures in Sentry where the feature already does that.

```typescript
async function fetchStockQuote(
  symbol: string,
  provider: string
): Promise<StockQuote> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const searchParams = new URLSearchParams({ provider });
    const response = await fetch(
      `/api/stocks/quote/${symbol}?${searchParams}`,
      { signal: controller.signal }
    );

    return await readStockApiResponse<StockQuote>(
      response,
      `Failed to fetch stock quote: ${response.statusText}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Multiple Queries

Use `useQueries` for dynamic symbol lists. Normalize and de-duplicate inputs before creating query configs, as `useWatchlistPrices` does:

```typescript
const uniqueSymbols = useMemo(
  () =>
    Array.from(
      new Set(
        symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
      )
    ),
  [symbols]
);
```

Return a view model that is convenient for components. `useWatchlistPrices` returns `pricesMap`, aggregate loading/refreshing flags, stale symbols, error symbols, per-symbol metadata, and refresh functions.

## Effects And Cleanup

Every effect that registers a timer or browser listener must clean it up:

```typescript
useEffect(() => {
  const intervalId = window.setInterval(() => setNow(Date.now()), tickMs);
  return () => window.clearInterval(intervalId);
}, [tickMs]);
```

```typescript
useEffect(() => {
  window.addEventListener('click', onClick);
  return () => window.removeEventListener('click', onClick);
}, []);
```

## Return Types

Use explicit return interfaces for hooks with composite return values. `UseWatchlistPricesResult` and `UseWatchlistPricesOptions` are the pattern to follow.

Avoid `any` in hook return values and cache transformations. Use shared domain types from `src/types` or `src/lib/types`.

## Avoid

- Putting feature-specific API hooks in `src/hooks`.
- Starting fetches when required inputs are missing.
- Leaving timeouts, intervals, event listeners, or websocket subscriptions without cleanup.
- Returning raw low-level query arrays to components when the component needs a feature-level view model.
