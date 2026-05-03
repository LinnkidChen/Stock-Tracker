---
name: trellis-superpowers-review
description: |
  Use after each logical implementation step, after a major feature, before merge, or when stuck. Runs Trellis-first review using PRD, implementation plan, diff, specs, and verification evidence.
---

# Trellis Superpowers Review Adapter

## Trigger Check

Run after implementation chunks and before continuing to the next major task.

## Steps

1. Read `.trellis/spec/agent-methodology/review.md`.
2. Identify active task, PRD, implementation plan, and changed files.
3. Run Trellis check or invoke the Trellis check sub-agent when available.
4. Compare diff against:
   - PRD acceptance criteria
   - implementation plan
   - applicable `.trellis/spec/` rules
5. Classify issues:
   - Critical
   - Important
   - Minor
6. Fix Critical and Important issues before proceeding.
7. Record review summary in the active task notes or final response.
