# TDD Gate

Use before implementing features, bug fixes, refactors, or behavior changes.

Rules:

- No production behavior change without a failing test first, unless the user explicitly grants an exception.
- Write the smallest test that describes the required behavior.
- Run the test and confirm it fails for the expected reason.
- Write the minimum code to pass.
- Run the test and relevant surrounding tests.
- Refactor only while tests stay green.
- If code was written before the test, either delete/rewrite under TDD or ask the user for an explicit exception.
- Bug fixes require a regression test that fails before the fix and passes after the fix.

Record evidence in the active Trellis task notes or final response:

- test command
- failing output summary
- passing output summary
- changed files
