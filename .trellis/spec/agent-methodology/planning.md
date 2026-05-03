# Planning Gate

Use this when a Trellis PRD has been approved and the task is non-trivial.

The plan must be saved as:

`.trellis/tasks/<active-task>/implementation-plan.md`

Plan requirements:

- Use exact file paths.
- Break work into small, independently verifiable steps.
- Prefer 2-5 minute implementation steps.
- Include the test file, implementation file, command to run, and expected output.
- No TODO, TBD, placeholder, "similar to above", or vague "add error handling".
- State YAGNI and DRY decisions explicitly.
- Every behavior change must include a TDD sequence:
  1. Write failing test.
  2. Run and confirm expected failure.
  3. Write minimal implementation.
  4. Run and confirm pass.
  5. Refactor only after green.
- For multi-package changes, split plan sections by package or component.
