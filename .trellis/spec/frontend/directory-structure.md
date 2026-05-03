# Directory Structure

This project is a single Next.js app rooted in `src/`. Document the structure that exists today; do not introduce a parallel `modules/` tree.

## Current Layout

```text
src/app/                         Next.js App Router pages, layouts, API routes
src/components/                  Shared app components and layout shell
src/components/ui/               shadcn/Radix primitives wrapped for this app
src/features/<feature>/          Feature-specific UI, hooks, store, lib, tests
src/hooks/                       Shared generic hooks
src/lib/                         Cross-feature services, providers, validation, utilities
src/types/                       Shared app/domain types
src/config/                      Shared UI/data-table configuration
src/constants/                   Shared constants and mock data
```

Real examples:

- `src/app/page.tsx` is a small server route gate that uses Clerk auth and redirects to `/dashboard/stocks`.
- `src/features/stock-dashboard/components/DashboardClient.tsx` owns the interactive stock dashboard surface.
- `src/features/stock-dashboard/hooks/useWatchlistPrices.ts` keeps feature data-fetching logic near the dashboard feature.
- `src/components/ui/button.tsx` is a reusable shadcn-style primitive, not feature code.
- `src/lib/providers/registry.ts` and `src/lib/providers/factory.ts` hold provider selection outside React components.

## Feature Modules

Use `src/features/<feature>/` for cohesive product areas. Existing feature folders use this shape:

```text
src/features/stock-dashboard/
  components/
  hooks/
  lib/
  utils/
  store.ts
```

Feature components import sibling feature logic with relative paths and shared code through `@/` aliases:

```typescript
import { useDashboardStore } from '../store';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { normalizeTicker } from '@/lib/validation/ticker';
import { Button } from '@/components/ui/button';
```

Keep API parsing, feature error mapping, chart setup, and feature-specific transformations in `features/<feature>/lib` or `features/<feature>/utils`. Examples include `src/features/stock-dashboard/lib/stock-api-error.ts`, `src/features/stock-dashboard/lib/chart-workspace.ts`, and `src/features/stock-dashboard/utils/price-formatters.ts`.

## Shared Components

Use `src/components/` for components that are reused outside one feature:

- `src/components/layout/*` for the application shell.
- `src/components/nav-*.tsx`, `src/components/breadcrumbs.tsx`, and `src/components/search-input.tsx` for shared navigation.
- `src/components/ui/*` for low-level UI primitives based on Radix, CVA, and Tailwind.

Do not put stock-dashboard-only components under `src/components/`; keep them in `src/features/stock-dashboard/components/`.

## Tests

The repo colocates most unit tests next to the code they cover:

- `src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx`
- `src/features/stock-dashboard/hooks/__tests__/useKlineSeries.test.tsx`
- `src/lib/services/__tests__/stock-service.test.ts`
- `src/lib/watchlist/storage.test.ts`

Use `__tests__/` for groups of component/hook tests and `.test.ts` next to small library modules where that pattern already exists.

## Naming

- React component files are PascalCase: `WatchlistCard.tsx`, `TickerInput.tsx`.
- Shared hooks use `use` prefix and camelCase: `useDebouncedCallback.ts`, `useWatchlistPrices.ts`.
- Feature utility files are kebab-case when they contain a cohesive domain helper: `stock-api-error.ts`, `chart-workspace.ts`.
- Tests mirror the subject name: `watchlist-card.test.tsx`, `technical-indicators.test.ts`.
- UI primitive files in `src/components/ui` are lower-case/kebab-case: `dropdown-menu.tsx`, `data-table.tsx`.

## Import Boundaries

- Prefer `@/` imports for shared code under `src/`.
- Prefer relative imports inside a feature when importing sibling components, hooks, lib, utils, or store.
- Shared code under `src/lib` must not import feature components.
- `src/components/ui` primitives should remain generic and should not import feature code.
- Barrel exports are used selectively. `src/features/stock-dashboard/components/index.ts` exists, but many local feature imports still use direct sibling paths. Follow the nearby pattern instead of adding barrels everywhere.

## Avoid

- Creating a new top-level `modules/` directory.
- Moving feature code into generic shared folders before there is real reuse.
- Importing feature-specific code from `src/components/ui`.
- Adding deep abstraction layers around simple `src/app` route files.
