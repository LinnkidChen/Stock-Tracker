# API Integration

Frontend code currently integrates with local Next.js route handlers under `src/app/api`. Client hooks use `fetch` plus TanStack Query. Do not add oRPC client code unless the project explicitly adopts oRPC in a separate task.

## Client Fetch Pattern

Feature hooks keep a small fetch helper above the hook. The helper is responsible for URL construction, abort timeout, response parsing, and error propagation.

Example from stock hooks:

```typescript
async function fetchKlineSeries(
  symbol: string,
  interval: KLineInterval = DEFAULT_KLINE_INTERVAL,
  provider: string = CANONICAL_QUOTE_PROVIDER
): Promise<KLineSeries> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const searchParams = new URLSearchParams({ provider, interval });
    const response = await fetch(
      `/api/stocks/kline/${symbol}?${searchParams.toString()}`,
      { signal: controller.signal }
    );

    return await readStockApiResponse<KLineSeries>(
      response,
      `Failed to fetch kline series: ${response.statusText}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Response Shapes

Route handlers generally return:

```typescript
{
  success: true,
  data: ...
}
```

or:

```typescript
{
  success: false,
  error: {
    code?: string,
    message: string,
    details?: unknown
  }
}
```

Keep client parsing centralized in helpers such as `readStockApiResponse` or feature-specific response mappers.

## API Route Handlers

Use `NextResponse.json`, validate inputs, enforce auth and rate limits where needed, and return explicit status codes.

Existing patterns:

- `src/app/api/watchlist/route.ts` validates Clerk auth, rate limits, Supabase auth setup errors, and watchlist request bodies.
- `src/app/api/stocks/quote/[symbol]/route.ts` and `src/app/api/stocks/kline/[symbol]/route.ts` validate ticker symbols and provider inputs.
- `src/app/api/ws/prices/route.ts` handles price stream behavior.

## Error Handling

- Map known provider/setup failures into stable error codes where the UI can show actionable states.
- Use `logger` in route handlers for server-side failures.
- Use Sentry in client hooks/components where the feature already has instrumentation.
- Do not swallow unexpected errors silently; either surface an error state or rethrow for React Query to own.

## Avoid

- Raw API response parsing duplicated across components.
- Long-running fetches without abort timeout in stock data hooks.
- Adding oRPC imports or generated query-key patterns to new code.
- Returning unstructured strings from API routes when the UI needs a code/message pair.
