# Verification Gate

Use before claiming work is complete, fixed, passing, ready, or safe to merge.

No completion claims without fresh verification evidence.

Before any completion claim:

1. Identify what command proves the claim.
2. Run the full command now.
3. Read the full output and exit code.
4. Report actual status with evidence.
5. Only then say whether the work is complete.

Examples:

- Tests pass -> provide test command and pass count/output summary.
- Lint clean -> provide lint command and output summary.
- Build succeeds -> provide build command and exit status.
- Bug fixed -> provide reproduction/regression test evidence.
- Requirements met -> check PRD acceptance criteria line by line.

Never rely on:

- Previous run
- Agent report
- "Should pass"
- Partial command
- Manual confidence
