# ISSUE-006 Create API contract package with shared schemas

## Source

- Linear issue: T-137
- Linear URL: https://linear.app/linnkidchen/issue/T-137/issue-006-create-api-contract-package-with-shared-schemas
- Linear status: In Progress
- Project: Stock Tracker
- Milestone: Milestone 1 - Architecture and monorepo foundation
- Priority: P0
- Labels: contracts, api, p0
- Phase: Phase 1 - Monorepo + contracts + domain boundaries
- Depends on: ISSUE-005

## Goal

Create shared schemas and types for all API surfaces.

## Scope

Create `packages/contracts/` with:

- `src/quote.ts`
- `src/kline.ts`
- `src/provider-health.ts`
- `src/watchlist.ts`
- `src/portfolio.ts`
- `src/errors.ts`
- `src/pagination.ts`
- `src/index.ts`

Define schemas:

- `StockQuote`
- `BatchQuoteResponse`
- `KLineRequest`
- `KLineSeries`
- `ProviderHealth`
- `Watchlist`
- `WatchlistItem`
- `PortfolioHolding`
- `PortfolioSummary`
- `APIError`

## Acceptance Criteria

- Zod schemas exist for quote, kline, provider health, watchlist, portfolio, and errors.
- Types are inferred from schemas.
- Existing Next app can import the package without circular dependency.
- Package has unit tests for schema parsing.

## Trellis Notes

- Confirm ISSUE-005 has established shared TypeScript, lint, and package conventions before starting implementation.
- This package should be framework-independent and safe for both app and server imports.
