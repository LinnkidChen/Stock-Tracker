# Design Document

## Overview

We will prune the app to a single authenticated dashboard route at `/dashboard/stocks`. All unrelated dashboard routes (overview, kanban, products, profile, portfolio, settings) and their feature modules will be removed. Navigation and command palette will surface only the Stocks destination. Only stocks-related APIs remain.

## Steering Document Alignment

### Technical Standards (tech.md)
- Next.js App Router; server components by default, client components opt-in.
- Clerk for authentication remains; `/dashboard/stocks` uses server-side `auth()` and redirects unauthenticated users to `/auth/sign-in`.
- Zustand + React Query already in use by stocks feature; remain unchanged.
- Lightweight Charts wrapper remains for price charts.

### Project Structure (structure.md)
- Keep feature-first: retain `src/features/stock-dashboard/*` only.
- Remove `src/features/(overview|kanban|products|profile)`.
- App routes under `src/app/dashboard/*` will only include `stocks/` and the common `layout.tsx`.
- Keep global providers/layout, UI components, and libs as shared infra.

## Code Reuse Analysis

### Existing Components to Leverage
- `src/features/stock-dashboard/components/*`: Core dashboard UI (TickerInput, MarketOverview, WatchlistCard, PortfolioCard, PriceChart).
- `src/features/stock-dashboard/lib/*`: lightweight-charts wrapper and ws client.
- `src/features/stock-dashboard/store.ts`: Zustand store.
- Shared UI and layout (`AppSidebar`, `Header`, `KBar`, shadcn components) remain but with pruned inputs.

### Integration Points
- WebSocket: `/api/ws/prices` kept for live updates.
- Watchlist API: `/api/watchlist` kept for CRUD on watchlist in-memory.

## Architecture

- Routes:
  - Root `/` and `/dashboard` redirect to `/dashboard/stocks`.
  - Only `/dashboard/stocks` page exists under dashboard.
- Navigation:
  - `src/constants/data.ts` exports `navItems` with a single `Stocks` entry.
  - `KBar` derives actions from `navItems`; it will expose just Stocks.
  - `AppSidebar` renders from `navItems`; dropdown will remove links to deleted routes (keep sign-out only).
- APIs:
  - Keep `/api/ws/prices` and `/api/watchlist`.
  - Remove `/api/dashboard/data` (unused).
- Cleanup:
  - Delete unused dashboard subroutes and corresponding feature folders.
  - Remove dead imports and update redirects.

## Components and Interfaces

### Redirects
- Purpose: Ensure app entry points land on stocks.
- Interfaces: `src/app/page.tsx`, `src/app/dashboard/page.tsx`.
- Changes: Update redirect target to `/dashboard/stocks`.

### Navigation Data
- Purpose: Single destination in sidebar and KBar.
- Interfaces: `src/constants/data.ts` consumed by `AppSidebar` and `KBar`.
- Changes: Export only one item for Stocks.

### AppSidebar Dropdown
- Purpose: Avoid links to removed pages.
- Interfaces: `src/components/layout/app-sidebar.tsx`.
- Changes: Remove Profile/Billing/Notifications items; keep avatar display and SignOut.

### API Removal
- Purpose: Reduce backend surface to stocks-related endpoints.
- Interfaces: `src/app/api/dashboard/data/route.ts`.
- Changes: Delete file.

## Data Models
- No new data models. In-memory watchlist retains shape `{ watchlist: string[] }` in API response.

## Error Handling
- Missing route imports after deletion: addressed by updating redirects and nav constants before removal.
- KBar/Sidebar referencing removed nav items: prevented by pruning `navItems`.

## Testing Strategy
- Manual verification (build/lint):
  - Navigate `/`, `/dashboard` -> both redirect to `/dashboard/stocks` when authed; unauthenticated redirect to sign-in.
  - Sidebar and KBar show only Stocks.
  - Stocks dashboard loads without runtime errors.
