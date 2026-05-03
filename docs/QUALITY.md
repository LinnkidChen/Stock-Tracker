# Quality Register

This file captures current quality posture and follow-up debt so future agents
can improve the codebase without rediscovering the same context.

## Current Strengths

- TypeScript strict mode is enabled in `tsconfig.json`.
- Jest is configured with `ts-jest`, `jsdom`, and local setup in
  `src/test-setup.ts`.
- Route, provider, service, hook, and component tests already exist near the code
  they cover.
- Sentry instrumentation files are present for client, server, and edge runtime.
- Stock provider selection is centralized through `src/lib/providers/config.ts`
  and `src/lib/providers/factory.ts`.
- Watchlist auth misconfiguration has a stable error code and tests.

## Verification Gates

Run these before release-quality handoff:

```bash
pnpm docs:check
pnpm lint:strict
pnpm test --runInBand
pnpm build
```

`pnpm verify` runs the aggregate gate in the same order.

## Known Gaps

- `AGENTS.md` and the docs map are new; keep them accurate as workflows change.
- The README still includes some broad template-era product claims. Use it as a
  product entry point, not the architecture source of truth.
- Import boundaries are documented but not mechanically enforced.
- The logger uses dynamic `fs` import in development for local error logs, which
  should be treated carefully in client-adjacent code.
- CI may need safe placeholder environment variables if future build-time code
  requires provider, Clerk, Supabase, or Sentry secrets.

## Follow-Up Debt

- Add focused architecture-boundary checks once the stock-dashboard and provider
  boundaries are stable enough to enforce.
- Reconcile `package-lock.json` versus pnpm usage, or document why both must
  remain.
- Refresh README feature tables so they only describe implemented pages and
  flows.
- Add tests for `scripts/check-agent-legibility.mjs` if its parsing rules become
  more complex than local link and script-reference validation.

## Documentation Quality Rules

- Prefer current-state documentation over target-state promises.
- Link to source files or local docs instead of duplicating long explanations.
- Keep known gaps explicit until they are fixed.
- Update docs and checks in the same change when a workflow becomes mandatory.
