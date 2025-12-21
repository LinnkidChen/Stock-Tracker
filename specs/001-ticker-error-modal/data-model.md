# Data Model: Overview 添加 Ticker 错误弹窗

## Entities

### TickerInput

- Description: The user-provided ticker value before and after normalization.
- Fields:
  - `rawInput`: string entered by the user
  - `normalizedSymbol`: uppercase, trimmed ticker string
  - `isValid`: boolean result from validation
  - `validationError`: user-facing validation error string (optional)

### WatchlistEntry

- Description: A ticker symbol that has been added to the watchlist.
- Fields:
  - `symbol`: normalized ticker symbol
  - `addedAt`: timestamp (if already tracked by the UI state)

### AddTickerError

- Description: User-facing error payload shown in the modal.
- Fields:
  - `category`: one of `validation`, `duplicate`, `rate_limited`, `network`, `unsupported`, `unknown`
  - `title`: short headline for the modal
  - `message`: detailed user-facing reason
  - `nextStep`: suggested action (e.g., edit input, retry later)
  - `source`: `client` or `server`
  - `httpStatus`: number (optional, for server-originated errors)

### AddTickerAttempt

- Description: A transient attempt to add a ticker.
- Fields:
  - `symbol`: normalized ticker symbol
  - `startedAt`: timestamp
  - `result`: `success` or `failure`
  - `error`: optional `AddTickerError`

## Relationships

- `TickerInput` produces an `AddTickerAttempt` when the user submits.
- `AddTickerAttempt` may emit an `AddTickerError` when failed.
- `WatchlistEntry` is created only on successful add.

## Validation Rules

- Ticker must be non-empty, 1-5 alphabetic characters, normalized to uppercase.
- Duplicate add attempts should be detected against existing watchlist symbols.
- Server-originated errors are mapped into `AddTickerError` categories without exposing raw internal messages.

## State Transitions

- `Idle` -> `Validating` -> `Submitting` -> `Success`
- `Idle` -> `Validating` -> `ErrorModalOpen` -> `Dismissed` -> `Idle`
- `Submitting` -> `ErrorModalOpen` -> `Dismissed` -> `Idle`

## Persistence Impact

- No new persistence or schema changes are required.
