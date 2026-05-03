# Systematic Debugging Gate

Use when there is a bug, test failure, build failure, performance issue, or unexpected behavior.

Do not propose a fix before root-cause investigation.

Phases:

1. Root-cause investigation
   - Read full error messages and stack traces.
   - Reproduce the issue.
   - Check recent changes.
   - Gather evidence across component boundaries.
   - Trace bad data or state backward to the source.
2. Pattern analysis
   - Find similar working code.
   - Compare broken and working paths.
   - Identify all meaningful differences.
   - Understand dependencies and assumptions.
3. Hypothesis testing
   - State one precise hypothesis.
   - Test one variable at a time.
   - If wrong, form a new hypothesis; do not stack random fixes.
4. Implementation
   - Create a failing reproduction or regression test.
   - Fix the root cause, not the symptom.
   - Verify the fix with fresh commands.
   - If three fix attempts fail, stop and question the architecture before trying another patch.
