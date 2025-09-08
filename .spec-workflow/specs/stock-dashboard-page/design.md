# Stock Dashboard Page Design Document

## Overview

Real-time stock portfolio dashboard with watchlist, portfolio tracking, and market data visualization using Next.js App Router, server components, and WebSocket for live updates. Price charting is implemented with Lightweight Charts™ (TradingView) via a thin wrapper for candlestick + volume rendering.

## Architecture

### Component Structure
```
app/dashboard/
├── page.tsx (Server Component - data fetching)
├── layout.tsx (Dashboard layout wrapper)
└── components/
    ├── DashboardClient.tsx (Client wrapper)
    ├── WatchlistCard.tsx
    ├── PortfolioCard.tsx
    ├── MarketOverview.tsx
    └── PriceChart.tsx
```

### Data Flow
- Server components fetch initial data
- Client components handle real-time updates via WebSocket
- React Query for caching & synchronization
- Zustand for client state management

### Charting Library
- Library: Lightweight Charts™ (TradingView)
- Integration: Client-side only, dynamically imported wrapper module
- Series: Primary candlestick series + separate histogram for volume
- Interactions: Zoom, pan, crosshair enabled; autoscale on data updates
- Rationale: Small bundle, high performance, fine-grained control versus full TradingView widget

## Components and Interfaces

### DashboardPage (Server Component)
- Purpose: Fetch initial data, authenticate user
- Interfaces: Props pass to DashboardClient
- Dependencies: Auth service, stock API client

### DashboardClient (Client Component)
- Purpose: Orchestrate dashboard, WebSocket connection
- Interfaces: `{initialData, userId}`
- Dependencies: WebSocket manager, React Query, Zustand store

### WatchlistCard
- Purpose: Display/manage watchlist stocks
- Interfaces: `{stocks[], onAdd(), onRemove()}`
- Dependencies: Stock price service, search component

### PortfolioCard
- Purpose: Show holdings, P&L, allocation
- Interfaces: `{holdings[], totalValue, dailyChange}`
- Dependencies: Portfolio service, chart library (sparklines may also use Lightweight Charts)

### MarketOverview
- Purpose: Display indices, trending stocks
- Interfaces: `{indices[], trending[]}`
- Dependencies: Market data service

### PriceChart
- Purpose: Render interactive price chart for selected ticker
- Interfaces: `{symbol, data, onReady?}`
- Dependencies: Lightweight Charts™ wrapper module
- Behavior: Initialize chart on mount, update series on ticker/data change, cleanup on unmount

## Data Models

### Stock
```typescript
interface Stock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  lastUpdated: Date
}
```

### Holding
```typescript
interface Holding {
  id: string
  userId: string
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  totalValue: number
  profitLoss: number
  profitLossPercent: number
}
```

### WatchlistItem
```typescript
interface WatchlistItem {
  id: string
  userId: string
  symbol: string
  addedAt: Date
  priceAlert?: number
  notes?: string
}
```

## API Design

### GET /api/dashboard/data
- Purpose: Fetch all dashboard data
- Response: `{portfolio, watchlist, marketData}`
- Cache: 1 minute server-side

### WebSocket /ws/prices
- Purpose: Real-time price updates
- Events: subscribe, unsubscribe, price_update
- Payload: `{symbol, price, change, volume}`

### POST /api/watchlist
- Purpose: Add/remove watchlist items
- Request: `{action: 'add'|'remove', symbol}`
- Response: Updated watchlist

## State Management

### Server State (React Query)
- Portfolio data (5-min cache)
- Watchlist (1-min cache)
- Market data (30-sec cache)

### Client State (Zustand)
- Active view tab
- Sort/filter preferences
- WebSocket connection status
- UI preferences (theme, layout)
- Selected ticker (persist last selection)

## Performance Optimizations

- Server-side data fetching with streaming
- Incremental static regeneration (ISR) for market data
- Virtual scrolling for large watchlists
- Debounced search with server-side filtering
- Memoized calculations for portfolio metrics
- WebSocket reconnection with exponential backoff
- Charting: dynamically import Lightweight Charts™; keep bundle delta < 200KB gzipped

## Error Handling

### API Failures
- Handling: Show cached data with stale indicator
- User Impact: "Unable to refresh" banner

### WebSocket Disconnection
- Handling: Auto-reconnect, queue missed updates
- User Impact: "Reconnecting..." status

### Invalid Stock Symbols
- Handling: Validate before adding, show suggestions
- User Impact: "Symbol not found" with alternatives

### Chart Initialization Failure
- Handling: Show inline fallback with retry; log structured error
- User Impact: Non-blocking message within chart area

## Testing Strategy

### Unit Testing
- Component rendering with mock data
- State management actions/reducers
- Utility functions (calculations, formatting)

### Integration Testing
- API endpoint responses
- WebSocket message handling
- Auth flow with dashboard access

### End-to-End Testing
- Add/remove watchlist items
- View portfolio performance
- Real-time price updates
- Responsive layout across devices

Note: This design explicitly specifies Lightweight Charts™ as the charting library for the PriceChart component.
