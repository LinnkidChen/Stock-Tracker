# Agent Guide

Stock Tracker is a Next.js App Router application for stock quotes, K-line
charts, and authenticated watchlists. Treat this file as the quick map; detailed
guidance lives in `docs/`.

## Start Here

- Project docs index: [docs/INDEX.md](docs/INDEX.md)
- Architecture map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Development workflow: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Reliability expectations: [docs/RELIABILITY.md](docs/RELIABILITY.md)
- Quality register: [docs/QUALITY.md](docs/QUALITY.md)
- Implementation plans: [docs/plans/README.md](docs/plans/README.md)

## Commands

- Install dependencies: `pnpm install`
- Start development server: `pnpm dev`
- Check docs and agent legibility: `pnpm docs:check`
- Lint strictly: `pnpm lint:strict`
- Run tests serially: `pnpm test --runInBand`
- Build: `pnpm build`
- Release-quality local gate: `pnpm verify`

## Repository Rules

- Validate untrusted input at route, query-string, and external-provider
  boundaries.
- Keep tests close to changed logic in `__tests__` folders or adjacent
  `*.test.ts(x)` files.
- Use Sentry spans, captures, and the shared logger for important API and async
  paths.
- Update docs when behavior, setup, architecture, or verification workflow
  changes.
- Keep `AGENTS.md` concise. Move detailed or evolving guidance into `docs/`.

## Current Boundaries

- App routes and API endpoints live under `src/app`.
- Stock dashboard UI, hooks, and chart helpers live under
  `src/features/stock-dashboard`.
- Provider integration lives under `src/lib/providers`; Longbridge is the only
  canonical quote provider.
- Watchlist persistence lives under `src/lib/watchlist` and depends on Clerk
  plus Supabase RLS configuration.
- Shared validation, formatting, logging, Supabase, and service code lives under
  `src/lib`.

## Before You Finish

Run the smallest relevant checks while iterating. Before handing off a completed
change, run `pnpm docs:check` plus the affected lint, test, and build commands,
or document the exact blocker and remediation.
