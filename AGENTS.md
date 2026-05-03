<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

## Subagents

- ALWAYS wait for all subagents to complete before yielding.
- Spawn subagents automatically when:
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently.
  - Isolation for risky changes or checks

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## Trellis-Superpowers Adapter

This project uses Trellis as the only workflow controller.

Do not run the full Superpowers workflow in this project session. Use only the Trellis adapter specs and skills:

- `.trellis/spec/agent-methodology/index.md`
- `.agents/skills/trellis-superpowers-planning`
- `.agents/skills/trellis-superpowers-tdd`
- `.agents/skills/trellis-superpowers-debugging`
- `.agents/skills/trellis-superpowers-verification`
- `.agents/skills/trellis-superpowers-review`

When rules conflict, Trellis wins.

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
