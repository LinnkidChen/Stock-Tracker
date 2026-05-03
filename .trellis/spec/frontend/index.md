# Frontend Guidelines

Project-specific frontend guidance for this Stock Tracker Next.js application.

## Current Stack

- Framework: Next.js App Router, React 19
- Language: TypeScript
- Styling: Tailwind CSS 4 with shadcn/Radix UI primitives
- Auth: Clerk
- Server/API: Next.js route handlers under `src/app/api`
- Server state: TanStack Query in client hooks
- Feature state: Zustand where cross-component dashboard state is needed
- Forms: react-hook-form and Zod where form validation is needed
- Observability: Sentry and local `logger` utilities

## Read First

| File | Use For |
| --- | --- |
| [Agent Methodology](../agent-methodology/index.md) | Trellis-first planning, TDD, debugging, verification, and review gates |
| [directory-structure.md](./directory-structure.md) | Where code belongs in `src/app`, `src/features`, `src/components`, `src/lib`, and `src/types` |
| [components.md](./components.md) | Server/client component split, UI primitives, accessibility, feature components |
| [hooks.md](./hooks.md) | React Query hooks, fetch helpers, effects, cleanup |
| [state-management.md](./state-management.md) | Zustand, React Query, local state, storage, URL state |
| [type-safety.md](./type-safety.md) | Shared domain types, runtime validation, production type rules |
| [api-integration.md](./api-integration.md) | Local route-handler response patterns and client fetch conventions |
| [authentication.md](./authentication.md) | Clerk auth patterns in routes and auth UI |
| [quality.md](./quality.md) | Lint, typecheck, Jest, testing conventions |
| [css-layout.md](./css-layout.md) | Existing layout and responsive guidance |

## Core Rules

- Use the real `src/features/<feature>` structure; do not create a new `modules/` tree.
- Default route files to server components; add `'use client'` only for browser APIs, hooks, event handlers, refs, Zustand, or React Query.
- Use Clerk for authentication. Do not introduce better-auth patterns.
- Use local Next.js API routes and existing response helpers. Do not introduce oRPC for new frontend API calls unless the project first adopts it explicitly.
- Use `src/components/ui` primitives before creating custom base controls.
- Keep stock-dashboard logic under `src/features/stock-dashboard`.
- Use React Query for fetched API data and Zustand only for feature UI/session preferences.
- Guard all browser storage with `typeof window !== 'undefined'`.
- Use shared types from `src/types` and `src/lib/types` before defining local duplicates.
- Run `pnpm lint` and `pnpm typecheck` for frontend changes; add targeted Jest tests for changed behavior.

## Known Obsolete Template Docs

`orpc-usage.md` is retained only as a placeholder because the generated Trellis scaffold included it. It is not an active project convention.
