# Quickstart: Overview 添加 Ticker 错误弹窗

## Prerequisites

- Node.js + pnpm installed
- Local dev server can run without external services

## Run

1. `pnpm dev`
2. Open `http://localhost:3000/dashboard/stocks` in a browser
3. Sign in if prompted

## Verify

1. In the Watchlist "Add symbol" input, submit an empty value.
   - Expect a modal with a clear validation message and a suggested next step.
2. Enter `AAPL1` and submit.
   - Expect a modal explaining the format requirement.
3. Enter `AAPL` and submit.
   - Expect success and the symbol added to the list.
4. Submit `AAPL` again.
   - Expect a modal indicating the symbol is already in the watchlist.
5. Optional: trigger rate limiting (e.g., rapid repeated adds).
   - Expect a modal indicating too many requests and a retry hint.
6. Optional: disable network and submit `MSFT`.
   - Expect a modal explaining the temporary failure and that retry is available.
7. Optional: force a 500 response from `/api/watchlist`.
   - Expect the unknown fallback modal without internal details.

## Expected Results

- The modal is dismissible via close button and `Esc`.
- Input value is preserved after an error and can be edited immediately.

## Manual Verification Results

- Empty input validation: Not run (pending)
- Invalid format (`AAPL1`): Not run (pending)
- Duplicate add (`AAPL` twice): Not run (pending)
- Rate limit (429): Not run (pending)
- Network failure: Not run (pending)
- Unknown server error (500): Not run (pending)
