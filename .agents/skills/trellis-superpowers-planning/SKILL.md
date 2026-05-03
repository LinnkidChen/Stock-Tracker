---
name: trellis-superpowers-planning
description: |
  Use after a Trellis PRD has been approved and before implementation begins for a non-trivial task. Converts the PRD into a precise Trellis implementation plan with exact files, tests, commands, expected outputs, TDD steps, and no placeholders.
---

# Trellis Superpowers Planning Adapter

## Trigger Check

Run only when there is an active Trellis task with an approved `prd.md`.

## Steps

1. Identify the active Trellis task directory.
2. Read:
   - `.trellis/tasks/<active-task>/prd.md`
   - `.trellis/spec/agent-methodology/planning.md`
   - relevant `.trellis/spec/**/index.md` entries
3. Write `.trellis/tasks/<active-task>/implementation-plan.md`.
4. Ensure every step has:
   - exact file path
   - concrete action
   - verification command
   - expected output
5. Reject TODO/TBD/placeholders.
6. Report the plan path and ask for approval before coding.
