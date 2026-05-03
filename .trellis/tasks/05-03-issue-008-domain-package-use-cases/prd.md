# ISSUE-008 Create domain package for business use cases

## Source

- Linear issue: T-139
- Linear URL: https://linear.app/linnkidchen/issue/T-139/issue-008-create-domain-package-for-business-use-cases
- Linear status: Todo
- Project: Stock Tracker
- Milestone: Milestone 1 - Architecture and monorepo foundation
- Priority: P0
- Labels: domain, p0, architecture
- Phase: Phase 1 - Monorepo + contracts + domain boundaries
- Depends on: ISSUE-006

## Goal

Move business logic out of framework adapters.

## Scope

Create `packages/domain/` with:

- `src/quotes/`
- `src/klines/`
- `src/watchlist/`
- `src/portfolio/`
- `src/providers/`
- `src/rate-limit/`
- `src/errors/`
- `src/index.ts`

Define ports:

- `MarketDataProvider`
- `QuoteCache`
- `KLineCache`
- `WatchlistRepository`
- `PortfolioRepository`
- `RateLimiter`
- `AuthContext`
- `Logger`
- `Clock`

Define use cases:

- `getBatchQuotes`
- `getKLines`
- `getProviderHealth`
- `getDefaultWatchlist`
- `replaceDefaultWatchlist`
- `addWatchlistItem`
- `removeWatchlistItem`
- `getPortfolioHoldings`
- `createPortfolioHolding`
- `updatePortfolioHolding`
- `deletePortfolioHolding`

## Acceptance Criteria

- Domain package imports contracts but does not import Next, Hono, Clerk, Supabase, Redis, Sentry, or Cloudflare.
- Use cases are testable with in-memory fake adapters.
- Unit tests cover quote cache hit, quote cache miss, provider fallback, watchlist ownership, and portfolio ownership.

## Trellis Notes

- Confirm ISSUE-006 is complete before starting this task.
- Keep domain logic framework-independent. Adapter-specific packages should depend on the domain, not the reverse.
