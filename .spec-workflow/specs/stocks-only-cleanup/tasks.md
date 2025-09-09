# Tasks Document

- [x] 1. Redirect root and dashboard to stocks

  - File: `src/app/page.tsx`
  - Change redirect target from `/dashboard/overview` to `/dashboard/stocks`.
  - Preserve unauthenticated redirect to `/auth/sign-in`.
  - Purpose: Land users on stocks-only dashboard per Req 1.
  - _Requirements: 1_

  - File: `src/app/dashboard/page.tsx`
  - Change redirect target from `/dashboard/overview` to `/dashboard/stocks`.
  - Preserve unauthenticated redirect.
  - _Requirements: 1_

- [x] 2. Prune navigation to only Stocks

  - File: `src/constants/data.ts`
  - Replace `navItems` with a single entry: `Stocks` → `/dashboard/stocks` (icon: `stocks`).
  - Remove all other items (Dashboard, Product, Account group, Kanban, Portfolio, Settings).
  - Purpose: Sidebar and KBar use this for available destinations.
  - _Requirements: 5_

- [x] 3. Simplify AppSidebar dropdown

  - File: `src/components/layout/app-sidebar.tsx`
  - Remove dropdown items linking to `/dashboard/profile`, Billing, Notifications.
  - Remove unused imports and `useRouter` usage.
  - Keep avatar display and SignOut only.
  - Purpose: Avoid links to removed pages.
  - _Requirements: 5_

- [x] 4. Remove unrelated dashboard routes

  - Dir: `src/app/dashboard/overview/` — delete entire folder.
  - File: `src/app/dashboard/kanban/page.tsx` — delete.
  - File: `src/app/dashboard/product/page.tsx` — delete.
  - File: `src/app/dashboard/product/[productId]/page.tsx` — delete.
  - File: `src/app/dashboard/profile/[[...profile]]/page.tsx` — delete.
  - File: `src/app/dashboard/portfolio/page.tsx` — delete.
  - File: `src/app/dashboard/settings/page.tsx` — delete.
  - Purpose: Leave only `/dashboard/stocks` and shared layout.
  - _Requirements: 2_

- [x] 5. Remove unrelated feature modules

  - Dir: `src/features/overview/` — delete.
  - Dir: `src/features/kanban/` — delete.
  - Dir: `src/features/products/` — delete.
  - Dir: `src/features/profile/` — delete.
  - Purpose: Reduce code surface and ensure no dead imports remain.
  - _Requirements: 2_

- [x] 6. Prune unused APIs

  - File: `src/app/api/dashboard/data/route.ts` — delete (unused by stocks).
  - File: `src/app/api/stocks/route.ts` — delete (placeholder; not used by stocks feature).
  - Purpose: Keep only `/api/ws/prices` and `/api/watchlist` per requirements.
  - _Requirements: 4_

- [x] 7. Verify and tidy
  - Run `pnpm build` to ensure no missing imports or type errors.
  - Run `pnpm lint` (and `pnpm lint:fix` if needed) to confirm style and unused import cleanup.
  - Manually check `/`, `/dashboard`, `/dashboard/stocks` flows and sidebar/KBar behavior.
  - _Requirements: 1, 2, 4, 5_
