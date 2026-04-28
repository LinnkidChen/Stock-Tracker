# Stock Tracker

Stock Tracker is a Next.js application for monitoring market quotes, charting
selected symbols, maintaining a watchlist, and tracking current portfolio
holdings. The current product is narrower than the long-term roadmap: it ships
the stock dashboard, chart workspace, setup diagnostics, watchlist persistence,
and portfolio holdings persistence, while dedicated portfolio, watchlist,
alerts, reports, settings, and overview pages remain planned.

## Project Status

### Implemented

- Authentication routes for sign-in and sign-up, with authenticated users
  redirected to `/dashboard/stocks`.
- `/dashboard/stocks` with market overview, quote provider selection, ticker
  search, watchlist card, and portfolio holdings card.
- `/dashboard/charts` with a klinecharts-based chart workspace for a selected
  ticker, interval, range, display preferences, and configurable SMA, EMA, RSI,
  MACD, Bollinger Bands, and VWAP indicators.
- `/dashboard/operations` with setup diagnostics for Clerk, Supabase, and
  Longbridge configuration.
- Longbridge-backed quote and k-line API routes.
- Watchlist API with Supabase persistence, symbol metadata, ordering, and tests.
- Portfolio holdings API with Supabase persistence for current symbol quantity
  and average cost, plus tests.
- Clerk-protected dashboard routes, Sentry instrumentation, React Query, Zustand
  client state, Jest unit tests, and a small Playwright smoke test.

### In Progress

- production readiness for local and deployed Clerk, Supabase, and Longbridge
  setup. The operations page exposes configuration gaps, but deployment-specific
  verification is still required.
- Portfolio management is currently limited to current holdings by symbol. Trade
  history, lots, realized P&L, and tax workflows are not implemented.
- Watchlist management exists inside the stock dashboard card, but does not yet
  have a dedicated full-page workflow.
- Charting supports k-line visualization, display preferences, and the initial
  technical indicator library. Custom indicator authoring is still planned.
- Dashboard UX still carries some starter-shell structure while the app becomes
  fully stock-tracker-specific.

### Planned

- Dedicated portfolio and watchlist pages.
- Price and indicator alerts.
- Reports, exports, and tax-oriented workflows.
- Settings page for user preferences and alert configuration.
- Full dashboard overview page instead of redirecting `/dashboard` to stocks.
- Custom technical indicators and analytics.
- Committed screenshots for the README.

## Feature Matrix

| Feature                   | UI                           | API     | Persistence        | Auth                            | Tests   | production readiness |
| :------------------------ | :--------------------------- | :------ | :----------------- | :------------------------------ | :------ | :------------------- |
| Auth shell and redirects  | Yes                          | N/A     | Clerk              | Yes                             | Partial | Partial              |
| Stock dashboard           | Yes                          | Yes     | Local client state | Dashboard protected             | Yes     | Partial              |
| Market quotes             | Yes                          | Yes     | N/A                | Dashboard protected, API public | Yes     | Partial              |
| Technical chart workspace | Yes                          | Yes     | Local client state | Dashboard protected             | Yes     | Partial              |
| Watchlist                 | Partial: dashboard card only | Yes     | Supabase           | Yes                             | Yes     | Partial              |
| Portfolio holdings        | Partial: dashboard card only | Yes     | Supabase           | Yes                             | Yes     | Partial              |
| Operations diagnostics    | Yes                          | N/A     | N/A                | Dashboard protected             | Yes     | Partial              |
| Dedicated portfolio page  | Planned                      | Partial | Partial            | Planned                         | Partial | Planned              |
| Dedicated watchlist page  | Planned                      | Partial | Partial            | Planned                         | Partial | Planned              |
| Alerts                    | Planned                      | Planned | Planned            | Planned                         | Planned | Planned              |
| Reports and exports       | Planned                      | Planned | Planned            | Planned                         | Planned | Planned              |
| Settings                  | Planned                      | Planned | Planned            | Planned                         | Planned | Planned              |

## Route Map

### Pages

| Route                   | Status               | Description                                                                                |
| :---------------------- | :------------------- | :----------------------------------------------------------------------------------------- |
| `/`                     | Implemented          | Redirects unauthenticated users to sign-in and authenticated users to `/dashboard/stocks`. |
| `/auth/sign-in`         | Implemented          | Clerk sign-in page.                                                                        |
| `/auth/sign-up`         | Implemented          | Clerk sign-up page.                                                                        |
| `/dashboard`            | Implemented redirect | Requires auth and redirects to `/dashboard/stocks`.                                        |
| `/dashboard/stocks`     | Implemented          | Main stock dashboard with market overview, watchlist card, and portfolio holdings card.    |
| `/dashboard/charts`     | Implemented          | Technical chart workspace for selected symbols.                                            |
| `/dashboard/operations` | Implemented          | Environment and product-readiness diagnostics.                                             |

### API Routes

| Route                          | Methods                          | Status      | Description                                                    |
| :----------------------------- | :------------------------------- | :---------- | :------------------------------------------------------------- |
| `/api/stocks/quote/[symbol]`   | `GET`                            | Implemented | Fetches a quote from the configured stock provider.            |
| `/api/stocks/kline/[symbol]`   | `GET`                            | Implemented | Fetches k-line series data from the configured stock provider. |
| `/api/stocks/providers/health` | `GET`                            | Implemented | Checks provider readiness.                                     |
| `/api/ws/prices`               | `GET` WebSocket upgrade          | Implemented | Poll-backed price updates for subscribed symbols.              |
| `/api/watchlist`               | `GET`, `POST`, `PATCH`, `DELETE` | Implemented | Authenticated watchlist CRUD, metadata, and ordering.          |
| `/api/portfolio/holdings`      | `GET`, `POST`                    | Implemented | Authenticated current holdings list and creation.              |
| `/api/portfolio/holdings/[id]` | `PATCH`, `DELETE`                | Implemented | Authenticated holdings update and deletion.                    |
| `/api/log`                     | `POST`                           | Implemented | Client log ingestion.                                          |

## Tech Stack

- Framework: Next.js 16 App Router
- Runtime: React 19, Node.js 20+
- Language: TypeScript 5.7.2
- Styling: Tailwind CSS v4 and shadcn/ui components
- Authentication: Clerk
- Persistence: Supabase with Clerk-issued JWTs
- Stock data provider: Longbridge
- Charting: klinecharts
- State management: Zustand and React Query
- Validation: Zod and local ticker validation
- Observability: Sentry and local structured logging
- Testing: Jest, Testing Library, and Playwright
- Package manager: pnpm

## Screenshots

Screenshots are not currently committed. The intended screenshot set is:

- Stock dashboard at `/dashboard/stocks`
- Technical chart page at `/dashboard/charts`
- Operations diagnostics at `/dashboard/operations`
- Auth screen at `/auth/sign-in`

## Project Structure

```plaintext
src/
├── app/
│   ├── api/
│   │   ├── portfolio/holdings/
│   │   ├── stocks/
│   │   ├── watchlist/
│   │   └── ws/prices/
│   ├── auth/
│   └── dashboard/
│       ├── charts/
│       ├── operations/
│       └── stocks/
├── components/
│   ├── layout/
│   └── ui/
├── features/
│   ├── auth/
│   ├── operations/
│   └── stock-dashboard/
├── lib/
│   ├── diagnostics/
│   ├── portfolio/
│   ├── providers/
│   ├── services/
│   ├── supabase/
│   └── watchlist/
└── types/
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Git

### Install

1. Clone the repository:

```bash
git clone https://github.com/LinnkidChen/Stock-Tracker.git
cd Stock-Tracker
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a local environment file:

```bash
cp env.example.txt .env.local
```

4. Configure environment variables as needed:

- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Longbridge: `LONGPORT_APP_KEY`, `LONGPORT_APP_SECRET`,
  `LONGPORT_ACCESS_TOKEN`, `LONGPORT_REGION`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Sentry: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `NEXT_PUBLIC_SENTRY_DISABLED`

5. Start the development server:

```bash
pnpm dev
```

The app runs at http://localhost:3000 by default.

## Supabase Authentication

Watchlist and portfolio holdings persistence depend on Supabase Row Level
Security and Clerk-issued Supabase JWTs. The expected setup is:

- Clerk has a JWT template named `supabase`.
- Supabase is configured to verify Clerk-issued JWTs.
- The JWT `sub` claim matches the Clerk user id.
- `database_schema/watchlist.sql` and `database_schema/portfolio.sql` have been
  applied to the Supabase project.

If this setup is missing, `/api/watchlist` returns
`WATCHLIST_AUTH_MISCONFIGURED`, and `/api/portfolio/holdings` returns
`PORTFOLIO_AUTH_MISCONFIGURED`.

## Portfolio Model

The current portfolio model stores one holding per user and symbol with:

- `symbol`
- `quantity`
- `avgCost`

The dashboard card uses current quote data to calculate total value, day P&L,
and total P&L. Trade history, tax lots, realized P&L, and export workflows are
outside the current implementation.

## Development Commands

```bash
pnpm dev          # Start the development server
pnpm build        # Build for production
pnpm start        # Start the production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Run ESLint fixes and format
pnpm format       # Format with Prettier
pnpm format:check # Check formatting
pnpm test         # Run Jest tests
pnpm test:e2e     # Run Playwright tests
pnpm test:e2e:ui  # Open Playwright UI mode
```

After a first install or Playwright upgrade, run:

```bash
pnpm exec playwright install chromium
```

Playwright starts a local Next.js server on `localhost:3100` by default. Set
`PLAYWRIGHT_BASE_URL` to reuse an already-running server.
