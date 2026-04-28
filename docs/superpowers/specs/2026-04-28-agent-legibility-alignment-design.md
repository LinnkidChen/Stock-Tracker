# Agent Legibility Alignment Design

**Date**: 2026-04-28
**Status**: Approved for planning
**Source inspiration**: OpenAI, "Harness engineering: leveraging Codex in an agent-first world"

## Goal

Realign Stock Tracker with the article's practical operating model for agent-first
software work: keep repository knowledge local, make the codebase legible to
future agent runs, and enforce important project rules mechanically instead of
relying on long prose instructions.

This first pass intentionally avoids reproducing OpenAI's full internal setup.
The project should gain a lightweight but durable foundation that helps Codex and
human contributors understand, validate, and improve the repository.

## Article Principles Applied

The design translates the article into these project-level principles:

- `AGENTS.md` is a concise map, not an encyclopedia.
- `docs/` is the versioned system of record for architecture, reliability,
  development workflow, and quality status.
- Important rules are enforced through scripts and CI, not only prose.
- Plans, decisions, and known debt stay in the repository.
- Validation favors feedback loops that agents can run locally without external
  context.

## Scope

### In Scope

- Add a short root `AGENTS.md` that points agents to deeper sources of truth.
- Create a structured `docs/` knowledge base for architecture, development,
  reliability, quality, and planning.
- Add lightweight mechanical enforcement for agent-legibility expectations.
- Add package scripts that expose the checks through standard commands.
- Add or update CI so the checks run automatically with existing lint/test gates.
- Update the README only where necessary to point humans and agents at the new
  documentation map.

### Out of Scope

- Rigid domain-layer import enforcement for the full app.
- Observability stack provisioning beyond documenting current Sentry/logging
  expectations.
- Large refactors of the stock dashboard, API routes, provider layer, or UI.
- Rewriting the existing Spec Kit workflow.
- Adding external services or network-dependent tooling.

## Proposed Repository Shape

```text
AGENTS.md
docs/
├── ARCHITECTURE.md
├── DEVELOPMENT.md
├── RELIABILITY.md
├── QUALITY.md
├── INDEX.md
└── plans/
    ├── README.md
    ├── active/
    └── completed/
scripts/
└── check-agent-legibility.mjs
.github/
└── workflows/
    └── verify.yml
```

`README.md` remains the product-facing entry point. It should briefly link to
`docs/INDEX.md` for contributor and agent operating context rather than becoming
a second source of truth.

## Agent Instruction Design

`AGENTS.md` should stay short enough to be read on every run. It should include:

- A quick project summary.
- The canonical commands for install, lint, test, build, and verification.
- The docs map with links to specific files.
- A small set of non-negotiable repository rules:
  - validate untrusted data at boundaries;
  - keep tests close to changed logic;
  - use structured logging/tracing for important API and async paths;
  - update docs when behavior or workflows change;
  - avoid adding stale or duplicate guidance.

Implementation detail belongs in `docs/`, not in `AGENTS.md`.

## Documentation Design

`docs/INDEX.md` is the navigation surface for contributors and agents.

`docs/ARCHITECTURE.md` should describe the current Next.js app layout, the stock
dashboard domain, API routes, provider layer, Supabase watchlist persistence,
Sentry instrumentation, and known architectural boundaries. It should state the
current shape accurately rather than inventing a target architecture.

`docs/DEVELOPMENT.md` should document setup, environment variables, package
manager expectations, local commands, test conventions, and how to add or update
plans.

`docs/RELIABILITY.md` should capture runtime expectations: boundary validation,
known external dependencies, current Sentry usage, logging rules, error-response
contracts, and local verification loops.

`docs/QUALITY.md` should serve as a lightweight quality register. It should list
current strengths, current gaps, verification commands, and follow-up debt. This
matches the article's idea of continuous cleanup without creating a heavy process.

`docs/plans/README.md` should explain where active and completed implementation
plans live. The existing `.specify` templates and constitution remain valid; this
plan area is for checked-in execution context that future agents can discover.

## Enforcement Design

Add `scripts/check-agent-legibility.mjs` with a focused set of checks:

- Required docs exist.
- `AGENTS.md` exists and stays concise.
- Local Markdown links in the required docs resolve.
- Required package scripts exist, including `lint`, `test`, `build`,
  `docs:check`, and `verify`.
- Docs reference only package scripts that exist when using `pnpm <script>`.

The script should emit clear remediation messages because those messages become
agent context when checks fail.

Add package scripts:

- `docs:check`: runs the agent-legibility checker.
- `verify`: runs docs check, lint, tests, and build in the repository's standard
  order.

If full `verify` is too slow for routine work, contributors can still run the
smaller commands individually. The aggregate command is the release-quality gate.

## CI Design

Add a GitHub Actions workflow that runs on pull requests and pushes:

1. Install dependencies with pnpm.
2. Run `pnpm docs:check`.
3. Run `pnpm lint:strict` if available, otherwise `pnpm lint`.
4. Run `pnpm test -- --runInBand`.
5. Run `pnpm build`.

The workflow should use the existing lockfile and package scripts. If build-time
environment variables are unavailable in CI, the implementation should either
document the limitation clearly or configure safe placeholder values only when
the app already supports them.

## Testing And Verification

The implementation is complete when:

- `pnpm docs:check` passes.
- `pnpm lint` or `pnpm lint:strict` passes.
- `pnpm test -- --runInBand` passes.
- `pnpm build` passes, or a build blocker is documented with exact remediation.

The enforcement script may not need unit tests if it remains simple and is
validated directly through `pnpm docs:check`. If it grows meaningful parsing or
edge-case handling, add tests beside the script or under the existing Jest setup.

## Risks And Mitigations

- **Risk**: Documentation becomes aspirational and diverges from code.
  **Mitigation**: Write docs from the current repository shape, add link/script
  checks, and keep quality gaps explicit.

- **Risk**: CI fails because the app requires secrets.
  **Mitigation**: Prefer checks that work without external services. Where build
  needs config, document required variables and use existing safe-disable flags.

- **Risk**: `AGENTS.md` grows into another monolith.
  **Mitigation**: Enforce a line limit and keep detailed guidance in focused docs.

- **Risk**: Boundary checks are added too early and block useful work.
  **Mitigation**: Start with docs/script enforcement. Capture stricter import or
  architecture linting as follow-up debt in `docs/QUALITY.md`.

## Open Decisions Resolved

- The selected scope is "docs/tooling alignment plus lightweight mechanical
  enforcement."
- Rigid architecture import enforcement is deferred.
- README remains product-facing; docs become contributor and agent-facing.
- The first implementation should be additive and avoid product behavior changes.
