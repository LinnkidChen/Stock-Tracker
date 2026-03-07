---

description: "Task list for feature implementation"
---

# Tasks: Stock KLine Chart Tab

**Inputs**: /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/plan.md, /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/spec.md
**Prereqs**: /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/research.md, /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/data-model.md, /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/contracts/kline-api.yaml

**Tests**: Included per plan charter (Jest + React Testing Library).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (shared foundation)

**Goal**: Add required dependency for klinecharts.

- [X] T001 Add klinecharts dependency in /Users/tongchen/Projects/Stock-Tracker-1/package.json and /Users/tongchen/Projects/Stock-Tracker-1/pnpm-lock.yaml

---

## Phase 2: Foundational (blocking prerequisites)

**Goal**: Server-side data pipeline and shared types used by all stories.

- [X] T002 [P] Extend KLine entity types (KLineCandle, TimeRange, KLineSeries) in /Users/tongchen/Projects/Stock-Tracker-1/src/lib/types/stock-api.ts
- [X] T003 [P] Add Longbridge-backed daily series fetcher with error handling in /Users/tongchen/Projects/Stock-Tracker-1/src/lib/providers/longbridge.ts
- [X] T004 Add KLineSeries transformation (1y daily, ascending timestamps) and getKLineSeries in /Users/tongchen/Projects/Stock-Tracker-1/src/lib/services/stock-service.ts
- [X] T005 Create KLine API route with validation, error mapping, and cache headers in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/route.ts

**Checkpoint**: KLine API endpoint is available for client consumption.

---

## Phase 3: User Story 1 - View KLine chart tab (Priority: P1) MVP

**Goal**: Show a second tab that renders the selected ticker's 1-year daily KLine chart.

**Independent test**: With a valid ticker and available data, switching to the KLine tab displays the chart and ticker label after a loading state.

### User Story 1 tests

- [X] T006 [P] [US1] Add API route tests for /api/stocks/kline/[symbol] in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts
- [X] T007 [P] [US1] Add useKlineSeries hook tests for success/loading in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/__tests__/useKlineSeries.test.tsx
- [X] T008 [P] [US1] Add KLineChart base rendering tests (loading + container) in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/__tests__/KLineChart.test.tsx

### User Story 1 implementation

- [X] T009 [P] [US1] Implement klinecharts wrapper (init/update/destroy, dynamic import) in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/lib/klinecharts.ts
- [X] T010 [P] [US1] Implement useKlineSeries React Query hook (1-day staleTime) in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/useKlineSeries.ts
- [X] T011 [US1] Implement KLineChart component with loading UI, ticker label, and time range label in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/KLineChart.tsx
- [X] T012 [US1] Implement StockChartTabs with Radix tabs and KLine tab span (ui.click) in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/StockChartTabs.tsx
- [X] T013 [US1] Replace PriceChart usage with StockChartTabs in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/DashboardClient.tsx
- [X] T014 [P] [US1] Export KLineChart and StockChartTabs in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/index.ts

**Checkpoint**: KLine tab renders the chart for a valid ticker.

---

## Phase 4: User Story 2 - Ticker switch updates chart (Priority: P2)

**Goal**: Switching ticker refreshes chart data and shows a no-data message when needed.

**Independent test**: Switching from ticker A to ticker B updates the chart and shows a no-data state if B has no candles.

### User Story 2 tests

- [X] T015 [P] [US2] Add ticker-change refetch tests in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/__tests__/useKlineSeries.test.tsx
- [X] T016 [P] [US2] Add ticker-switch and no-data UI tests in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/__tests__/KLineChart.test.tsx

### User Story 2 implementation

- [X] T017 [P] [US2] Update useKlineSeries to surface no-data state and reset on ticker change in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/useKlineSeries.ts
- [X] T018 [US2] Update KLineChart to clear prior data and render no-data UI in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/KLineChart.tsx
- [X] T019 [P] [US2] Add multi-ticker guard messaging in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/TickerInput.tsx
- [X] T020 [P] [US2] Add Sentry span for ticker switch in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/store.ts

**Checkpoint**: Chart refreshes on ticker change and handles no-data cases.

---

## Phase 5: User Story 3 - Clear guidance on failures (Priority: P3)

**Goal**: When data fails to load or ticker is invalid, users see clear guidance and a retry path.

**Independent test**: Simulate a failed request and invalid ticker to confirm error messaging and retry behavior.

### User Story 3 tests

- [X] T021 [P] [US3] Add error and retry UI tests in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/__tests__/KLineChart.test.tsx
- [X] T022 [P] [US3] Add KLine API error mapping tests in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts

### User Story 3 implementation

- [X] T023 [US3] Add invalid ticker prompt, error UI, and retry action in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/KLineChart.tsx
- [X] T024 [P] [US3] Add Sentry spans + captureException in /Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/useKlineSeries.ts
- [X] T025 [P] [US3] Add Sentry spans + captureException in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/route.ts

**Checkpoint**: Failures show a clear message and the retry path works.

---

## Phase 6: Polish and cross-cutting concerns

**Goal**: Documentation updates and final usability notes.

- [X] T026 [P] Update KLine quickstart verification steps in /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/quickstart.md
- [X] T027 [P] Update user-facing KLine tab notes and limitations in /Users/tongchen/Projects/Stock-Tracker-1/README.md

---

## Dependencies and execution order

### Phase dependencies

- Setup (Phase 1) must finish before Foundational (Phase 2)
- Foundational (Phase 2) must finish before any user story
- User stories can proceed after Foundational, in priority order P1 -> P2 -> P3
- Polish depends on targeted user stories completing

### User story dependencies

- US1 depends only on Foundational
- US2 depends on US1 for tab surface and base chart
- US3 depends on US1 and US2 for complete UI flows

---

## Parallel execution examples

### US1

You can run these in parallel:

```text
T006, T007, T008 (tests in separate files)
T009 and T010 (wrapper + hook)
```

### US2

You can run these in parallel:

```text
T015 and T016 (tests in separate files)
T017, T019, T020 (hook, input, store)
```

### US3

You can run these in parallel:

```text
T021 and T022 (tests in separate files)
T024 and T025 (hook + API instrumentation)
```

---

## Implementation strategy

### MVP first (US1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 end-to-end (tests -> implementation).
3. Validate US1 independently before moving to US2/US3.
