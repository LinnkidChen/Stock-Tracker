---
name: trellis-superpowers-verification
description: |
  Use before saying work is complete, fixed, passing, ready, merged, or safe. Requires fresh verification commands and evidence before any completion claim.
---

# Trellis Superpowers Verification Adapter

## Trigger Check

Run before completion claims, commits, PR creation, `/trellis:finish-work`, or moving to another task.

## Steps

1. Read `.trellis/spec/agent-methodology/verification.md`.
2. Identify claims that need proof.
3. Run fresh verification commands:
   - tests
   - lint
   - typecheck
   - build
   - project-specific checks from `.trellis/spec/`
4. Read full output and exit codes.
5. Compare acceptance criteria from active PRD.
6. Report evidence and gaps.
7. Only then state whether the task is complete.
