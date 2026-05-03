---
name: trellis-superpowers-tdd
description: |
  Use before implementing any Trellis task that changes behavior, fixes a bug, refactors code, or adds a feature. Enforces test-first red-green-refactor inside the Trellis task workflow.
---

# Trellis Superpowers TDD Adapter

## Trigger Check

Run before production code changes for features, bug fixes, refactors, and behavior changes.

## Steps

1. Confirm the active Trellis task and acceptance criteria.
2. Read `.trellis/spec/agent-methodology/tdd.md`.
3. Write the smallest failing test first.
4. Run the test and record expected failure evidence.
5. Write minimal implementation code.
6. Run the test and relevant surrounding tests.
7. Refactor only after green.
8. Do not claim completion; hand off to the verification gate.
