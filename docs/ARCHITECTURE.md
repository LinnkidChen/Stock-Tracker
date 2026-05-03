# Architecture

Stock Tracker is a single Next.js application using the App Router. The current
product surface is a dashboard for stock quotes, K-line charting, and
authenticated watchlist management.

## Runtime Shape

- `src/app` contains pages, layouts, and route handlers.
- `src/app/dashboard/stocks/page.tsx` renders the stock dashboard route.
- `src/app/dashboard/charts/page.tsx` renders the chart route.
- `src/app/api/stocks/quote/[symbol]/route.ts` returns normalized quote data.
- `src/app/api/stocks/kline/[symbol]/route.ts` returns K-line series data.
- `src/app/api/watchlist/route.ts` handles authenticated watchlist reads and
  updates.
- `src/app/api/ws/prices/route.ts` exposes the current price polling endpoint.

## Feature Modules

`src/features/stock-dashboard` owns stock-dashboard-specific UI and client data
flow:

- `components/`: dashboard cards, ticker input, chart navigation, K-line chart,
  quote provider toggle, and watchlist UI.
- `hooks/`: quote, K-line, and watchlist-price data hooks.
- `lib/`: chart integration, websocket/polling client helpers, ticker error
  mapping, and performance helpers.
- `store.ts`: Zustand state for dashboard interactions.

Shared UI primitives live in `src/components/ui`. App layout and shell
components live in `src/components/layout`.

## Data Providers

Market data goes through `src/lib/services/stock-service.ts`, which delegates to
`src/lib/providers/factory.ts`.

The canonical provider is Longbridge:

- `src/lib/providers/config.ts` maps `longbridge` and the legacy `default`
  provider value to the canonical provider.
- `src/lib/providers/longbridge.ts` performs Longbridge requests and converts
  responses into project types from `src/lib/types/stock-api.ts`.
- `Documents/Longbridge_OpenAPI_Doc.md` is the local provider reference.

Do not add a new quote provider by branching API routes directly. Add provider
behavior behind the `StockDataProvider` interface in `src/lib/providers/types.ts`
and update factory/config tests.

## Watchlist Persistence

Watchlists use Clerk authentication and Supabase persistence:

- `src/app/api/watchlist/route.ts` validates auth, request body, ticker symbols,
  and rate limits write requests.
- `src/lib/watchlist/storage.ts` reads and writes watchlists.
- `src/lib/supabase/server.ts` creates the Supabase server client and requests a
  Clerk JWT template named `supabase`.
- `database_schema/watchlist.sql` defines the Supabase table and RLS policies.

When Clerk or Supabase auth is misconfigured, the API returns a stable
`WATCHLIST_AUTH_MISCONFIGURED` response instead of silently falling back to an
untrusted token.

## Validation And Types

- Ticker validation lives in `src/lib/validation/ticker.ts`.
- Query-string parser helpers live in `src/lib/parsers.ts` and use Zod plus
  `nuqs/server`.
- Shared stock API contracts live in `src/lib/types/stock-api.ts`.
- App-facing stock types live in `src/types/stocks.ts` and `src/types/watchlist.ts`.

Validate data at the edge of each boundary: route params, request bodies,
query-string state, external provider responses, and persisted user input.

## Observability

Sentry is initialized through:

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`

The shared logger is `src/lib/logger.ts`. API routes should use Sentry spans for
important request paths and `logger.warn` or `logger.error` for structured
failure context.

## Test Layout

Tests live beside the code they cover:

- Provider and service tests are under `src/lib/**/__tests__`.
- Route tests live under matching `src/app/api/**/__tests__` directories.
- Feature component and hook tests live under
  `src/features/stock-dashboard/**/__tests__`.

Jest is configured in `jest.config.js` with `ts-jest`, `jsdom`, and the `@/`
path alias.
