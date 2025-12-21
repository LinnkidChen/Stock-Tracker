# Research: Overview 添加 Ticker 错误弹窗

## Decision 1: Error dialog component

- Decision: Use the existing modal component at `/Users/tongchen/Projects/Stock-Tracker/src/components/ui/modal.tsx` with a small feature-level wrapper for error copy and actions.
- Rationale: Consistent styling and accessibility via Radix Dialog; no new dependencies; aligns with existing UI patterns.
- Alternatives considered: Inline error text only (insufficient detail), toast notification (less prominent and easier to miss), custom dialog component (unnecessary duplication).

## Decision 2: Error taxonomy and message mapping

- Decision: Create a deterministic mapping from error sources to user-facing categories and messages:
  - Client validation errors from `/Users/tongchen/Projects/Stock-Tracker/src/lib/validation/ticker.ts`
  - Duplicate ticker detection using current watchlist state
  - Server responses from `/Users/tongchen/Projects/Stock-Tracker/src/app/api/watchlist/route.ts` (e.g., invalid input, rate limit)
  - Network/timeout failures and unknown errors as a safe fallback
- Rationale: Enables detailed, testable error copy with clear next steps; avoids exposing internal error strings.
- Alternatives considered: Display raw API error messages (risk of unclear or technical language), single generic error for all cases (does not meet requirements).

## Decision 3: Observability for add ticker failures

- Decision: Instrument add-ticker attempts with Sentry spans for UI submit and API call boundaries, and capture exceptions on unexpected failures; include error category and symbol length as attributes.
- Rationale: Required by the constitution and supports diagnosing error trends without leaking internal details.
- Alternatives considered: No instrumentation or console logging only (violates logging/trace requirements).
