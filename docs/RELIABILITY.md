# Reliability

Reliability work should make failures explicit, observable, and testable without
depending on external service access during local verification.

## Boundary Validation

Validate all untrusted input at the boundary where it enters the system:

- Route params and request bodies in `src/app/api/**/route.ts`.
- Ticker symbols through `src/lib/validation/ticker.ts`.
- Query-string state through parser helpers in `src/lib/parsers.ts`.
- Provider names through `src/lib/providers/config.ts`.
- Supabase environment through `src/lib/supabase/env.ts`.

Return stable API error codes for expected failures. Do not leak provider
secrets, raw tokens, or unbounded external errors into client responses.

## External Dependencies

Longbridge is the only canonical market-data provider. Provider code should map
external responses into `src/lib/types/stock-api.ts` before route handlers return
data to clients.

Clerk authenticates users. Supabase stores watchlists and relies on RLS. The
server expects a Clerk JWT template named `supabase`; if it is missing or returns
no token, watchlist routes should surface `WATCHLIST_AUTH_MISCONFIGURED`.

Sentry is optional at runtime through `NEXT_PUBLIC_SENTRY_DISABLED=true`, but
important API and async paths should still use the shared logger and tracing
patterns.

## Logging And Tracing

Use `src/lib/logger.ts` instead of ad hoc `console.*` in app code. For API
routes and asynchronous provider calls:

- create Sentry spans around significant request or provider operations;
- capture unexpected exceptions with Sentry;
- log structured context such as route path, provider, symbol, and stable error
  code;
- avoid logging raw credentials, full auth tokens, or personal data.

The quote route is the current reference for `Sentry.startSpan`,
`Sentry.captureException`, and structured logger context.

## Error Response Contracts

Stock quote APIs return `APIResponse<T>` from `src/lib/types/stock-api.ts` with:

- `success`
- `data`
- `error`
- `timestamp`

Watchlist APIs return `success` plus either `data.watchlist` or an `error`
object. Preserve stable error codes when clients may branch on them.

## Local Verification Loop

Use these checks according to change scope:

```bash
pnpm docs:check
pnpm lint:strict
pnpm test --runInBand
pnpm build
```

For provider, route, validation, or watchlist changes, run the targeted tests
first, then the broader verification gate before handoff.

## Known Reliability Gaps

- The watchlist write rate limiter is an in-memory process-local map. It is fine
  for lightweight protection but not a distributed production rate limit.
- Some README product descriptions still reflect the starter-dashboard heritage.
  Treat `docs/ARCHITECTURE.md` as the current implementation map.
- Stricter import-boundary linting is deferred until the feature/module
  boundaries stabilize.
