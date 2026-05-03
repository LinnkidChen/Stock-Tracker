# Review Gate

Use after each logical implementation task, after major feature work, before merge, and when stuck.

Default Trellis review mechanism:

- Run `trellis-check` or the platform's Trellis check skill/sub-agent.
- Compare the diff against the active PRD and implementation plan.
- Verify coding standards from applicable `.trellis/spec/` files.
- Run lint/typecheck/test/build commands relevant to changed files.

Severity:

- Critical: must fix immediately.
- Important: must fix before continuing to the next task.
- Minor: may document for later if it does not violate acceptance criteria.

When reviewer feedback is wrong:

- Push back with code evidence, tests, or PRD citations.
- Do not ignore valid technical feedback.
