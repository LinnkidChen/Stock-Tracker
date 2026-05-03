# ISSUE-004 Convert repo to apps/packages pnpm workspace

## Source

- Linear issue: T-135
- Linear URL: https://linear.app/linnkidchen/issue/T-135/issue-004-convert-repo-to-appspackages-pnpm-workspace
- Linear status: Todo
- Project: Stock Tracker
- Milestone: Milestone 1 - Architecture and monorepo foundation
- Priority: P0
- Labels: infra, monorepo, p0
- Phase: Phase 1 - Monorepo + contracts + domain boundaries
- Depends on: ISSUE-003

## Goal

Move from the current single-package workspace to a real monorepo for `apps/web`, `apps/api`, `apps/market-data-worker`, and shared packages.

## Scope

Restructure to:

- `apps/next-legacy/`
- `packages/placeholder/`

Move the existing Next app into `apps/next-legacy/`.

Update:

- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- eslint config
- prettier config
- jest config
- playwright config

## Acceptance Criteria

- Existing Next app still runs from `apps/next-legacy`.
- Existing tests still pass or failures are explicitly documented.
- Root `package.json` has workspace-level scripts.
- No business logic changes in this issue.

## Trellis Notes

- Confirm ISSUE-003 is complete before starting this task.
- Keep the change mechanical and avoid feature behavior changes.
