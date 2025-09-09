# Requirements Document

## Introduction

We will simplify the application to keep only the Stocks dashboard at `/dashboard/stocks`, removing all unrelated pages, routes, and features while preserving authentication and any APIs/components required by the stocks experience. This reduces code surface, navigation complexity, and maintenance burden.

## Alignment with Product Vision

This aligns with the focus on a Stock Analysis Dashboard and Watchlist features (real-time updates via WebSocket, portfolio/market insights). By removing non-stocks modules (overview, products, kanban, profile, etc.), we streamline the product to its core value for investors and traders.

## Requirements

### Requirement 1: Stocks is the only dashboard route

User Story: As an authenticated user, I want the app to focus solely on the Stocks dashboard so that I can quickly access stock analysis without extra sections.

Acceptance Criteria

1. WHEN a user visits `/dashboard` THEN the system SHALL redirect to `/dashboard/stocks`.
2. WHEN a user visits `/` THEN the system SHALL redirect to `/dashboard/stocks` if authenticated, else to `/auth/sign-in`.
3. WHEN navigating via sidebar or command palette THEN the system SHALL only present a single destination: `/dashboard/stocks`.

### Requirement 2: Remove unrelated dashboard pages and features

User Story: As a maintainer, I want to remove unused routes and code so that the codebase is minimal and easier to maintain.

Acceptance Criteria

1. IF files under `src/app/dashboard/(overview|kanban|product|profile|portfolio|settings)` exist THEN the system SHALL remove them.
2. IF feature modules `src/features/(overview|kanban|products|profile)` exist THEN the system SHALL remove them.
3. IF API `src/app/api/dashboard/data` exists and is unused by stocks THEN the system SHALL remove it.
4. The build SHALL pass with no imports referencing removed modules.

### Requirement 3: Preserve authentication for stocks access

User Story: As a user, I want the `/dashboard/stocks` page to remain protected so that only signed-in users can access it.

Acceptance Criteria

1. WHEN an unauthenticated user requests `/dashboard/stocks` THEN the system SHALL redirect to `/auth/sign-in`.
2. Auth routes at `/auth/sign-in` and `/auth/sign-up` SHALL remain available.
3. Clerk integration (server-side `auth`) SHALL remain intact.

### Requirement 4: Keep only APIs required for stocks

User Story: As a developer, I want only relevant API routes present so that the backend surface is minimal and focused.

Acceptance Criteria

1. WebSocket price stream at `/api/ws/prices` SHALL remain.
2. Watchlist API at `/api/watchlist` SHALL remain.
3. API routes unrelated to stocks (e.g., `/api/dashboard/data`) SHALL be removed.

### Requirement 5: Navigation and UX reflect the single destination

User Story: As a user, I want navigation and search to be simple so that I’m not distracted by unavailable sections.

Acceptance Criteria

1. Sidebar nav items (from `src/constants/data.ts`) SHALL only include a single link: `Stocks` → `/dashboard/stocks`.
2. KBar actions (command palette) that derive from nav items SHALL only include the `Stocks` destination.
3. Sidebar profile dropdown SHALL not link to removed pages.

## Non-Functional Requirements

### Code Architecture and Modularity

- Single Responsibility Principle: Keep only the stocks feature and shared UI/libs.
- Modular Design: Do not entangle remaining code with removed modules.
- Dependency Management: Remove dead imports and references.
- Clear Interfaces: Maintain existing component boundaries for the stocks feature.

### Performance

- Redirects remain fast; no additional network calls added.
- No regressions to stocks dashboard performance.

### Security

- Clerk-protected routes preserved; no accidental exposure of `/dashboard/stocks`.

### Reliability

- Build and lint SHALL pass.
- No runtime errors due to missing modules.

### Usability

- Navigation presents only relevant stocks destinations.
- Root and dashboard routes lead directly to stocks.
