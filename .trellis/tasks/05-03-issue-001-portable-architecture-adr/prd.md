# ISSUE-001 Create ADR for portable Stock Tracker architecture

## Source

- Linear issue: T-132
- Linear URL: https://linear.app/linnkidchen/issue/T-132/issue-001-create-adr-for-portable-stock-tracker-architecture
- Linear status: Done
- Project: Stock Tracker
- Milestone: Milestone 1 - Architecture and monorepo foundation
- Priority: P0
- Labels: p0, architecture, migration
- Phase: Phase 0 - Migration governance
- Depends on: none

## Goal

Create an ADR that defines the target portable architecture and prevents repeated technology direction debates.

## Scope

Create `docs/adr/001-portable-stock-tracker-architecture.md`.

The ADR should define:

- Frontend: Vite React SPA
- API: Hono HTTP API, Node container by default
- Market data: separate Node worker
- Database: Postgres repository layer
- Cache: Redis/Valkey abstraction
- Auth: provider-neutral JWT/OIDC verifier
- Contracts: OpenAPI and Zod schemas
- Realtime: polling first, SSE later, WebSocket last
- Deployment: Docker-first, cloud-portable

## Acceptance Criteria

- ADR explains why the project is moving away from Next.js full-stack coupling.
- ADR explicitly states that business logic must not import Next, Hono, Cloudflare, Clerk, Supabase, or Sentry directly.
- ADR defines the target runtime matrix: local Docker, Node container, optional serverless/edge.
- ADR includes rollback principle: existing Next app remains operational until cutover.

## Trellis Notes

- Keep this as a documentation task.
- Treat Linear status as source metadata only. Do not archive this Trellis task unless the corresponding repository work has been verified locally.
