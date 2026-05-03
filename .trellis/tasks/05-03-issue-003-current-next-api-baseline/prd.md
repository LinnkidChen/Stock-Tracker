# ISSUE-003 Document existing Next API behavior and response shapes

## Source

- Linear issue: T-134
- Linear URL: https://linear.app/linnkidchen/issue/T-134/issue-003-document-existing-next-api-behavior-and-response-shapes
- Linear status: In Progress
- Project: Stock Tracker
- Milestone: Milestone 1 - Architecture and monorepo foundation
- Priority: P0
- Labels: contracts, api, p0, migration
- Phase: Phase 0 - Migration governance
- Depends on: ISSUE-002

## Goal

Freeze current API request and response behavior before migrating API routes.

## Scope

Document current routes:

- `GET /api/stocks/quote/[symbol]`
- `GET /api/stocks/kline/[symbol]`
- `GET /api/stocks/providers/health`
- `GET /api/ws/prices`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `PATCH /api/watchlist`
- `DELETE /api/watchlist`
- `GET /api/portfolio/holdings`
- `POST /api/portfolio/holdings`
- `PATCH /api/portfolio/holdings/[id]`
- `DELETE /api/portfolio/holdings/[id]`
- `POST /api/log`

Create:

- `docs/migration/current-api-baseline.md`
- `tests/fixtures/current-api/`

## Acceptance Criteria

- Each current route has documented input, output, error shape, and auth behavior.
- Quote, kline, watchlist, and portfolio have fixture examples.
- Existing API behavior is treated as compatibility baseline for the new `/v1` API.

## Trellis Notes

- Confirm whether ISSUE-002 is represented by an existing Trellis task before starting implementation.
- This task should inspect current code and fixtures before drafting documentation.
