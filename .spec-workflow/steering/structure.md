# Project Structure

## Directory Organization

```
Stock-Tracker/
├── src/                                 # Main source code directory
│   ├── app/                            # Next.js App Router pages and API routes
│   │   ├── (auth)/                     # Authentication pages group
│   │   │   ├── sign-in/                # Sign-in page
│   │   │   └── sign-up/                # Sign-up page
│   │   ├── dashboard/                  # Protected dashboard routes
│   │   │   ├── overview/               # Dashboard overview with parallel routes
│   │   │   │   ├── @area_stats/        # Area chart statistics slot
│   │   │   │   ├── @bar_stats/         # Bar chart statistics slot
│   │   │   │   ├── @pie_stats/         # Pie chart statistics slot
│   │   │   │   └── @sales/             # Sales data slot
│   │   │   ├── product/                # Product management pages
│   │   │   ├── profile/                # User profile management
│   │   │   └── kanban/                 # Kanban board for task tracking
│   │   ├── api/                        # API routes for backend logic
│   │   └── layout.tsx                  # Root layout with providers
│   ├── components/                     # Reusable React components
│   │   ├── ui/                         # Shadcn UI components
│   │   │   └── table/                  # Data table components
│   │   ├── layout/                     # Layout components (header, nav, etc.)
│   │   ├── modal/                      # Modal components
│   │   └── kbar/                       # Command palette components
│   ├── features/                       # Feature-based modules
│   │   ├── dashboard/                  # Dashboard feature module
│   │   │   ├── components/             # Feature-specific components
│   │   │   ├── actions/                # Server actions
│   │   │   ├── schemas/                # Zod validation schemas
│   │   │   └── utils/                  # Feature utilities
│   │   ├── kanban/                     # Kanban board feature
│   │   │   ├── components/             # Kanban components
│   │   │   ├── stores/                 # Zustand stores
│   │   │   └── types.ts                # TypeScript types
│   │   └── products/                   # Product management feature
│   │       ├── components/             # Product components
│   │       ├── actions/                # CRUD actions
│   │       └── schemas/                # Form schemas
│   ├── hooks/                          # Custom React hooks
│   ├── lib/                            # Core utilities and configurations
│   │   ├── auth.ts                     # Clerk authentication config
│   │   ├── utils.ts                    # Shared utility functions
│   │   └── validators.ts               # Validation utilities
│   ├── stores/                         # Global Zustand stores
│   ├── styles/                         # Global styles
│   │   └── globals.css                 # Global CSS with Tailwind
│   └── types/                          # TypeScript type definitions
├── public/                              # Static assets
│   └── assets/                         # Images, icons, fonts
├── docs/                               # Project documentation
│   ├── specs/                          # Feature specifications
│   └── management/                     # Project management docs
├── .spec-workflow/                     # Spec workflow documents
│   └── steering/                       # Steering documents
│       ├── product.md                  # Product vision
│       ├── tech.md                     # Technology decisions
│       └── structure.md                # This document
└── config files                        # Configuration files
    ├── next.config.mjs                 # Next.js configuration
    ├── tailwind.config.ts              # Tailwind CSS configuration
    ├── tsconfig.json                   # TypeScript configuration
    ├── package.json                    # Dependencies and scripts
    └── .env.local                      # Environment variables
```

## Naming Conventions

### Files

- **Components**: `PascalCase.tsx` (e.g., `StockCard.tsx`, `PortfolioTable.tsx`)
- **Pages**: `page.tsx` for App Router pages
- **Layouts**: `layout.tsx` for nested layouts
- **API Routes**: `route.ts` for API endpoints
- **Actions**: `kebab-case.ts` (e.g., `get-stocks.ts`, `update-portfolio.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `date-utils.ts`, `format-currency.ts`)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-debounce.ts`, `use-stock-data.ts`)
- **Stores**: `kebab-case-store.ts` (e.g., `portfolio-store.ts`, `dashboard-store.ts`)
- **Types**: `types.ts` or `kebab-case.types.ts`
- **Schemas**: `kebab-case.schema.ts` (e.g., `product.schema.ts`)
- **Tests**: `[filename].test.ts` or `[filename].spec.ts`

### Code

- **Components/Classes**: `PascalCase` (e.g., `StockChart`, `PortfolioManager`)
- **Functions/Methods**: `camelCase` (e.g., `calculateReturns`, `fetchStockData`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`, `API_BASE_URL`)
- **Variables**: `camelCase` (e.g., `currentPrice`, `portfolioValue`)
- **Types/Interfaces**: `PascalCase` (e.g., `Stock`, `Portfolio`, `UserProfile`)
- **Enums**: `PascalCase` with `UPPER_SNAKE_CASE` values

## Import Patterns

### Import Order

1. React and Next.js imports
2. Third-party library imports
3. UI component imports from `@/components/ui`
4. Feature component imports
5. Utility and lib imports
6. Type imports
7. Style imports

### Module Organization

```typescript
// Example import structure
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StockCard } from '@/features/dashboard/components/stock-card';
import { formatCurrency } from '@/lib/utils';
import type { Stock, Portfolio } from '@/types';
import '@/styles/dashboard.css';
```

- Use absolute imports with `@/` prefix for all internal imports
- Group related imports together
- Separate type imports with `type` keyword
- Keep imports alphabetically sorted within groups

## Code Structure Patterns

### Component Organization

```typescript
// 1. Imports
// 2. Type definitions
// 3. Constants
// 4. Component definition
// 5. Hooks
// 6. Event handlers
// 7. Render logic
// 8. Export
```

### Server Action Organization

```typescript
// 1. 'use server' directive
// 2. Imports
// 3. Type definitions
// 4. Validation schemas
// 5. Main action function
// 6. Helper functions
// 7. Error handling
```

### Feature Module Organization

```
feature/
├── components/          # Feature-specific components
├── actions/            # Server actions
├── hooks/              # Feature-specific hooks
├── schemas/            # Validation schemas
├── stores/             # Feature state management
├── types.ts            # Feature types
├── utils.ts            # Feature utilities
└── index.ts            # Public API exports
```

## Code Organization Principles

1. **Feature-First Architecture**: Organize code by feature rather than technical layer for better cohesion
2. **Server/Client Separation**: Clearly distinguish server components from client components
3. **Single Responsibility**: Each file should have one clear, focused purpose
4. **Colocation**: Keep related code close together within feature modules
5. **Type Safety**: Leverage TypeScript throughout with strict mode enabled
6. **Reusability**: Extract common patterns into shared components and utilities

## Module Boundaries

### Core vs Features

- **Core (`/lib`, `/components/ui`)**: Shared utilities and UI primitives used across features
- **Features (`/features/*`)**: Self-contained modules with their own components, logic, and state
- **App (`/app`)**: Routes and pages that compose features together

### Public API vs Internal

- Each feature module exports only its public API through `index.ts`
- Internal implementation details remain private to the module
- Shared types are exported from `/types` directory

### Server vs Client

- Server components are the default (no 'use client' directive)
- Client components explicitly marked with 'use client'
- Server actions marked with 'use server'
- Clear separation of server-only code (data fetching, auth) from client code

## Code Size Guidelines

- **File size**: Maximum 300 lines per file (split larger files)
- **Component size**: Maximum 150 lines per component
- **Function size**: Maximum 50 lines per function
- **Nesting depth**: Maximum 3 levels of nesting
- **Complexity**: Cyclomatic complexity < 10 per function

## Dashboard/Monitoring Structure

```
src/
└── features/
    └── dashboard/              # Stock tracking dashboard
        ├── components/
        │   ├── stock-card/     # Individual stock display
        │   ├── portfolio-table/# Portfolio overview table
        │   ├── charts/         # Various chart components
        │   └── indicators/     # Technical indicator displays
        ├── actions/
        │   ├── fetch-stocks.ts # Stock data fetching
        │   └── update-portfolio.ts # Portfolio updates
        ├── stores/
        │   └── dashboard-store.ts # Dashboard state
        └── types.ts           # Dashboard-specific types
```

### Separation of Concerns

- Dashboard components isolated from business logic
- Data fetching through server actions
- State management via Zustand stores
- Real-time updates through WebSocket connections (planned)

## Documentation Standards

- All exported functions must have JSDoc comments
- Complex business logic includes inline explanatory comments
- README.md at project root with setup instructions
- Feature-specific documentation in feature folders
- API documentation for all server actions
- Type definitions are self-documenting through descriptive names
