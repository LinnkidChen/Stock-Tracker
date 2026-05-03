# Agent Legibility Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an agent-legible documentation layer, local enforcement script, and CI wiring inspired by OpenAI's harness-engineering article.

**Architecture:** Keep `AGENTS.md` short and route detailed guidance through focused `docs/` files. Add one Node.js checker that validates the docs map, local Markdown links, required package scripts, and referenced `pnpm` scripts. Wire the checker into package scripts and GitHub Actions without changing product behavior.

**Tech Stack:** Next.js 16, TypeScript, pnpm, Jest, Node.js ESM script, GitHub Actions.

---

## File Structure

- Create `AGENTS.md`: concise repository map and operating rules for agents.
- Create `docs/INDEX.md`: navigation hub for humans and agents.
- Create `docs/ARCHITECTURE.md`: current app structure and boundaries.
- Create `docs/DEVELOPMENT.md`: setup, commands, environment, workflow.
- Create `docs/RELIABILITY.md`: validation, logging, tracing, dependency expectations.
- Create `docs/QUALITY.md`: quality register, known gaps, verification gates.
- Create `docs/plans/README.md`: where execution plans live.
- Create `scripts/check-agent-legibility.mjs`: repo-local enforcement script.
- Modify `package.json`: add `docs:check` and `verify`.
- Create `.github/workflows/verify.yml`: CI gate for docs, lint, test, build.
- Modify `README.md`: link to the new docs map.

## Task 1: Agent-Facing Documentation

**Files:**
- Create: `AGENTS.md`
- Create: `docs/INDEX.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/DEVELOPMENT.md`
- Create: `docs/RELIABILITY.md`
- Create: `docs/QUALITY.md`
- Create: `docs/plans/README.md`
- Modify: `README.md`

- [ ] **Step 1: Add the docs and root agent map**

Write accurate documentation from the current repository state. Keep `AGENTS.md`
under 120 lines and move details into `docs/`.

- [ ] **Step 2: Validate local links manually**

Run: `rg -n "\\]\\(([^)#]+)" AGENTS.md README.md docs`

Expected: every local Markdown target points to a file that exists after Step 1.

## Task 2: Enforcement Script With TDD

**Files:**
- Create: `scripts/check-agent-legibility.mjs`

- [ ] **Step 1: Write the initial failing checker invocation**

Run: `node scripts/check-agent-legibility.mjs`

Expected: FAIL with `Cannot find module` because the checker does not exist.

- [ ] **Step 2: Implement the checker**

Create `scripts/check-agent-legibility.mjs` as an ESM Node script. It should:

- load `package.json`;
- require `AGENTS.md`, `README.md`, and required docs;
- enforce `AGENTS.md` line count at or below 120 lines;
- check local Markdown links in required docs;
- require package scripts `lint`, `test`, `build`, `docs:check`, and `verify`;
- check documented `pnpm <script>` references against package scripts, allowing
  pnpm built-ins such as `install`, `exec`, and `dlx`;
- print all failures and exit `1`, or print a success summary and exit `0`.

- [ ] **Step 3: Verify the checker fails before scripts are wired**

Run: `node scripts/check-agent-legibility.mjs`

Expected: FAIL because `docs:check` and `verify` are not yet in `package.json`.

## Task 3: Package Scripts And CI

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/verify.yml`

- [ ] **Step 1: Add package scripts**

Add:

```json
"docs:check": "node scripts/check-agent-legibility.mjs",
"verify": "pnpm docs:check && pnpm lint:strict && pnpm test --runInBand && NEXT_PUBLIC_SENTRY_DISABLED=true pnpm build"
```

- [ ] **Step 2: Add CI workflow**

Create `.github/workflows/verify.yml` that checks out the repo, enables pnpm,
installs dependencies with `pnpm install --frozen-lockfile`, runs
`pnpm docs:check`, runs `pnpm lint:strict`, runs `pnpm test --runInBand`, and
runs `pnpm build`.

- [ ] **Step 3: Run docs check**

Run: `pnpm docs:check`

Expected: PASS. If it fails, fix the reported doc, link, or script mismatch.

## Task 4: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run lint**

Run: `pnpm lint:strict`

Expected: PASS or existing failures documented with exact output.

- [ ] **Step 2: Run tests**

Run: `pnpm test --runInBand`

Expected: PASS or existing failures documented with exact output.

- [ ] **Step 3: Run build**

Run: `pnpm build`

Expected: PASS or an environment/config blocker documented with exact output and
remediation.

- [ ] **Step 4: Review diff**

Run: `git diff --stat` and `git diff --check`

Expected: no whitespace errors; changed files match the approved spec.
