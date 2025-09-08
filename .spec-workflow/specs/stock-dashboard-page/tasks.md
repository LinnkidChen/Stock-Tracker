# Tasks Document

- [x] 1. Define core stock types in src/types/stocks.ts
  - File: src/types/stocks.ts
  - Define interfaces: Stock, Holding, WatchlistItem, PriceUpdate, ChartCandle, ApiError
  - Export enums and helpers for timeframes where needed
  - Purpose: Establish type safety across dashboard feature
  - _Leverage: existing TypeScript patterns in repo_
  - _Requirements: 2, 3, 4; Non-Functional: Code Architecture

- [x] 2. Add ticker validation util in src/lib/validation/ticker.ts
  - File: src/lib/validation/ticker.ts
  - Implement `isValidTicker(symbol: string): boolean` and `normalizeTicker`
  - Enforce 1–5 uppercase letters; return error messages for UI
  - Purpose: Validate user input before fetch/subscribe
  - _Leverage: src/lib/* validation utilities if present_
  - _Requirements: 3.1, 3.2

- [x] 3. Create dashboard route at /dashboard/stocks (server component)
  - File: src/app/dashboard/stocks/page.tsx
  - Authenticate user (redirect to sign-in if not)
  - Fetch initial data (watchlist, portfolio snapshot, market overview) server-side
  - Render client orchestrator with initial props
  - Purpose: Entry point that matches navigation requirement
  - _Leverage: Auth provider (Clerk) if configured; Next.js App Router_
  - _Requirements: 1.1, 1.2, 1.3

- [x] 4. Add /dashboard/stocks layout wrapper
  - File: src/app/dashboard/stocks/layout.tsx
  - Provide page shell, container, and metadata
  - Purpose: Consistent layout for dashboard subpages
  - _Leverage: existing root layout styles_
  - _Requirements: 1.3; Non-Functional: Usability (responsive)

- [x] 5. Create feature module scaffolding
  - Files:
    - src/features/stock-dashboard/components/DashboardClient.tsx
    - src/features/stock-dashboard/components/WatchlistCard.tsx
    - src/features/stock-dashboard/components/PortfolioCard.tsx
    - src/features/stock-dashboard/components/MarketOverview.tsx
    - src/features/stock-dashboard/components/PriceChart.tsx
    - src/features/stock-dashboard/components/TickerInput.tsx
  - Export components and minimal props per design
  - Purpose: Modularize UI per repository guidelines
  - _Leverage: src/components/ui/* design system, Tailwind utilities_
  - _Requirements: 1.3, 2.4, 3.1, 4.4; Non-Functional: Modularity, Usability

- [x] 6. Implement DashboardClient orchestrator (client component)
  - File: src/features/stock-dashboard/components/DashboardClient.tsx
  - Initialize WebSocket manager, React Query provider usage, wire child components
  - Hold selected ticker in Zustand store and sessionStorage for last-selected persistence
  - Purpose: Coordinate real-time updates and user interactions
  - _Leverage: src/lib/store/* if present; React Query; Zustand_
  - _Requirements: 1.4, 4.1, 4.3; Non-Functional: Reliability

- [x] 7. Create Zustand store for dashboard state
  - File: src/features/stock-dashboard/store.ts
  - State: selectedTicker, loading flags, ws status; actions to set ticker and hydrate last ticker from storage
  - Purpose: Predictable client-side state management
  - _Leverage: Zustand pattern if already used; otherwise install-free local store_
  - _Requirements: 1.4, 3.3, 4.1; Non-Functional: Usability

- [x] 8. Add React Query provider
  - File: src/components/providers/query-provider.tsx
  - Create provider with sensible defaults and suspense support
  - Purpose: Cache and synchronize server state (portfolio/watchlist/market)
  - _Leverage: React Query setup patterns_
  - _Requirements: Non-Functional: Performance, Reliability

- [x] 9. Implement Lightweight Charts™ wrapper
  - File: src/features/stock-dashboard/lib/lightweight-charts.ts
  - Lazy-load @tradingview/lightweight-charts via dynamic import; expose `createPriceChart(container, options)`
  - Handle resize, cleanup, and series setup (candles + volume)
  - Purpose: Encapsulate Lightweight Charts integration per design/steering
  - _Leverage: next/dynamic; requestAnimationFrame utilities_
  - _Requirements: 2.1, 2.3, 2.4; Non-Functional: Performance

- [x] 10. Build PriceChart component using Lightweight Charts™
  - File: src/features/stock-dashboard/components/PriceChart.tsx
  - Render chart container; show skeleton/loading; update on ticker change
  - Enable zoom/pan/crosshair; autoscale on data load
  - Purpose: Visualize price data with smooth updates
  - _Leverage: Lightweight Charts wrapper; Tailwind classes_
  - _Requirements: 2.3, 2.4, 4.4, 4.1; Non-Functional: Performance, Usability

- [x] 11. Create TickerInput with validation and autocomplete
  - File: src/features/stock-dashboard/components/TickerInput.tsx
  - Validate 1–5 uppercase letters; inline errors; debounce suggestions after 2 chars
  - Emit submit to update selected ticker and trigger fetch/subscription
  - Purpose: Enable user to choose symbols
  - _Leverage: src/lib/validation/ticker.ts; src/components/ui/Input, Command palette if present_
  - _Requirements: 3.1, 3.2, 3.3, 3.5

- [x] 12. Implement API route: GET /api/dashboard/data
  - File: src/app/api/dashboard/data/route.ts
  - Return `{ portfolio, watchlist, marketData }`; cache 60s on server
  - Gracefully handle errors with structured ApiError
  - Purpose: Provide initial payload for server render
  - _Leverage: Next.js Route Handlers; caching headers_
  - _Requirements: Design: API Design (GET /api/dashboard/data); Non-Functional: Reliability

- [x] 13. Implement API route: POST /api/watchlist
  - File: src/app/api/watchlist/route.ts
  - Body `{ action: 'add'|'remove', symbol }`; validate and update
  - Return updated watchlist or error; rate-limit by user
  - Purpose: Manage watchlist items
  - _Leverage: Validation util; simple in-memory or placeholder service for now_
  - _Requirements: Design: POST /api/watchlist; Security: rate limit, validation

- [x] 14. Implement WebSocket price updates endpoint
  - File: src/app/api/ws/prices/route.ts
  - Accept upgrade to WebSocket; handle `subscribe`/`unsubscribe`; broadcast `price_update`
  - Include reconnection/backoff guidance in client
  - Purpose: Real-time ticker updates channel
  - _Leverage: Next.js Edge runtime or Node adapter; fall back to polling if unsupported_
  - _Requirements: Design: WebSocket /ws/prices; Reliability: reconnection

- [x] 15. Wire client WebSocket manager
  - File: src/features/stock-dashboard/lib/ws-client.ts
  - Handle connect/reconnect with exponential backoff; queue messages while offline
  - Expose subscribe(symbol) and unsubscribe(symbol)
  - Purpose: Robust client connectivity
  - _Leverage: WebSocket API; browser storage for last ticker_
  - _Requirements: 4.1, Reliability: WebSocket Disconnection

- [x] 16. Display WatchlistCard with add/remove actions
  - File: src/features/stock-dashboard/components/WatchlistCard.tsx
  - List items; call POST /api/watchlist; optimistic update with rollback on error
  - Purpose: Manage user’s tracked symbols
  - _Leverage: React Query mutations; ui/Card components_
  - _Requirements: Design: WatchlistCard; Usability: responsive

- [x] 17. Display PortfolioCard with P&L and allocation
  - File: src/features/stock-dashboard/components/PortfolioCard.tsx
  - Compute totals; memoize calculations; handle empty states
  - Purpose: Show holdings summary and performance
  - _Leverage: formatting utils; ui components_
  - _Requirements: Design: PortfolioCard; Performance: memoization

- [x] 18. Display MarketOverview (indices, trending)
  - File: src/features/stock-dashboard/components/MarketOverview.tsx
  - Fetch market data; show stale indicator when cached
  - Purpose: Snapshot of market context
  - _Leverage: GET /api/dashboard/data; ui components_
  - _Requirements: Design: MarketOverview; Error Handling: cached fallback

- [x] 19. Error handling and toasts
  - Files: src/components/ui/ToastProvider.tsx (if missing), use existing toast hook
  - Show retry on chart init failure; toast on API errors; banner on stale data
  - Purpose: Communicate failures and recovery
  - _Leverage: existing ui/toast; React error boundaries_
  - _Requirements: 2.2, 4.2; Non-Functional: Reliability, Usability

- [x] 20. Persist last selected ticker
  - File: src/features/stock-dashboard/store.ts (extend), plus storage util
  - Save last 5 tickers in localStorage; restore on load; sync with session
  - Purpose: Convenience and continuity across sessions
  - _Leverage: storage helpers if present_
  - _Requirements: Reliability: Local storage backup; 1.4

- [x] 21. Performance and lazy loading
  - Files: PriceChart.tsx (dynamic import), MarketOverview.tsx (suspense)
  - Lazy-load Lightweight Charts library; debounce search; virtualize large lists
  - Purpose: Meet performance targets and smooth UX
  - _Leverage: React.lazy/next/dynamic; react-window if present_
  - _Requirements: Non-Functional: Performance

- [x] 22. Accessibility and keyboard shortcuts
  - Files: TickerInput.tsx, page.tsx
  - Add "/" to focus ticker input, Enter to submit; aria labels
  - Purpose: Improve usability and accessibility
  - _Leverage: existing keybinding helpers if any_
  - _Requirements: Usability: Keyboard shortcuts

- [x] 23. Add env example entries
  - File: env.example.txt (append)
  - Add placeholders for data providers (e.g., STOCKS_API_KEY), SENTRY vars if used
  - Purpose: Prepare configuration without committing secrets
  - _Leverage: repo guidelines for env management_
  - _Requirements: Security: environment variables

- [x] 24. Optional: Set up testing (Vitest + RTL)
  - Files:
    - package.json (add scripts)
    - src/features/stock-dashboard/__tests__/ticker-validation.test.ts
    - src/features/stock-dashboard/__tests__/store.test.ts
  - Write focused unit tests for validation and store logic
  - Purpose: Guard critical behavior without full test suite overhaul
  - _Leverage: Testing guidelines in repo_
  - _Requirements: Testing Strategy (Unit)

- [x] 25. Documentation and cleanup
  - Files: README section (usage), inline JSDoc for public functions
  - Document how to run the dashboard and any flags
  - Purpose: Smooth handoff and maintainability
  - _Leverage: existing docs style_
  - _Requirements: Non-Functional: Maintainability
