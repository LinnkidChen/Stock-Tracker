# Development

## Prerequisites

- Node.js 20 or newer.
- pnpm as the canonical package manager.
- A local `.env` or `.env.local` created from `env.example.txt` when running
  provider-backed features.

The repository also contains `package-lock.json`, but current project scripts
and CI use pnpm.

## Setup

```bash
pnpm install
cp env.example.txt .env.local
pnpm dev
```

The app starts at `http://localhost:3000`.

## Environment Variables

Clerk can run in no-key development mode, but claimed/authenticated app flows
need:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

Longbridge-backed quotes and K-line data need:

- `LONGPORT_APP_KEY`
- `LONGPORT_APP_SECRET`
- `LONGPORT_ACCESS_TOKEN`
- `LONGPORT_REGION`

Watchlists need Supabase plus Clerk JWT integration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- a Clerk JWT template named `supabase`
- Supabase JWT verification configured to trust Clerk-issued tokens

Sentry is controlled by:

- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ORG`
- `NEXT_PUBLIC_SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_SENTRY_DISABLED`

Set `NEXT_PUBLIC_SENTRY_DISABLED=true` for local or CI builds that should not
use the Sentry webpack wrapper.

## Commands

```bash
pnpm dev
pnpm docs:check
pnpm lint
pnpm lint:strict
pnpm test
pnpm test --runInBand
pnpm build
pnpm verify
```

Use the smallest command that proves the change while iterating. Use
`pnpm verify` before release-quality handoff.

## Planning Workflow

Durable implementation context belongs in versioned files:

- Design specs from Superpowers live in `docs/superpowers/specs/`.
- Implementation plans from Superpowers live in `docs/superpowers/plans/`.
- General active and completed project plans live under `docs/plans/`.
- Spec Kit templates and constitution remain under `.specify/`.

When behavior, setup, or architecture changes, update the closest relevant doc
in the same change.

## Test Conventions

- Put tests near the code under `__tests__` directories or as adjacent
  `*.test.ts(x)` files.
- Prefer testing behavior through public functions, route handlers, or rendered
  components.
- Keep tests isolated from real external services. Mock Longbridge, Clerk,
  Supabase, and browser-only chart APIs where needed.
- Cover happy path, validation failures, and expected error responses for API
  changes.

## Documentation Checks

`pnpm docs:check` runs `scripts/check-agent-legibility.mjs`. It validates that
required docs exist, local Markdown links resolve, `AGENTS.md` remains concise,
and documented `pnpm` scripts exist in `package.json`.
