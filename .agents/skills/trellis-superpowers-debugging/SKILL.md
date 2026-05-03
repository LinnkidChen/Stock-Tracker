---
name: trellis-superpowers-debugging
description: |
  Use when encountering a bug, failing test, build failure, performance issue, or unexpected behavior in a Trellis task. Requires root-cause investigation before proposing fixes.
---

# Trellis Superpowers Debugging Adapter

## Trigger Check

Run before proposing fixes for any technical failure.

## Steps

1. Read `.trellis/spec/agent-methodology/debugging.md`.
2. Reproduce the issue.
3. Read full error output.
4. Check recent changes.
5. Gather evidence at component boundaries.
6. Compare against similar working code.
7. State one hypothesis.
8. Test one variable.
9. Create a failing regression test when possible.
10. Fix root cause only.
11. Send result to verification gate.
