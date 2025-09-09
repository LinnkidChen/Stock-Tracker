# Technology Stack

## Project Type

Stock Tracker is a modern web application built as a SaaS-ready admin dashboard platform. It combines server-side rendering with client-side interactivity to deliver a responsive, data-driven interface for business management and analytics.

## Core Technologies

### Primary Language(s)

- Language: TypeScript 5.7.2
- Runtime: Node.js 20+ with Next.js 15 App Router
- Tooling: pnpm, ESLint, Prettier, Husky

### Key Dependencies/Libraries

- Next.js 15 (App Router)
- React 19
- Clerk (authentication)
- shadcn/ui (Radix UI)
- Tailwind CSS v4
- TanStack Table v8
- Zustand v5
- React Hook Form + Zod
- Sentry
- kbar (command palette)

### Visualization Libraries

- Lightweight Charts™ (TradingView) — Standard for financial price/time-series charts (candles, volume). Mandatory for stock price charts across the app.
- Recharts — For analytics/summary visualizations (KPIs, distributions, comparisons) where financial chart precision isn’t required.

## Application Architecture

- App Router: file-based routing with layouts, loading, error boundaries
- Server Components by default; client components opt-in
- Parallel routes for independent dashboard sections
- API routes for backend logic within the same repo
- Feature modules for cohesion and clear boundaries

## Data & State

- Caching: Next.js caching with ISR where applicable
- Server state: React Query (config via provider)
- Client state: Zustand (persistent where needed)
- Data format: JSON; strict TypeScript types

## External Integrations

- Authentication: Clerk (JWT)
- Error tracking: Sentry
- Real-time: WebSocket endpoints for live price updates

## Development Environment

- Build: Next.js + Turbopack
- Package: pnpm
- DX: Fast refresh, strict TypeScript
- Code quality: ESLint + Prettier (Tailwind plugin)
- Pre-commit: Husky + lint-staged

## Deployment

- Targets: Vercel (preferred) or any Node.js host
- CI/CD: Git-based pipeline
- Requirements: Node.js 20+, pnpm

## Technical Requirements & Constraints

- Performance: <3s initial load, TTI <5s
- Accessibility: WCAG 2.1 AA
- Compatibility: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Security: HTTPS, CSP, XSS/CSRF protections (Clerk for auth)

## Scalability & Reliability

- Availability target: 99.9%
- Horizontal scaling with edge functions where sensible
- ISR/edge caching for market data

## Technical Decisions & Rationale

1. Next.js 15 with App Router — Performance, SSR/ISR, developer experience.
2. TypeScript strict mode — Type safety and maintainability.
3. Clerk — Offloads auth complexity with robust features.
4. shadcn/ui — Accessible primitives with full control and small bundle.
5. Zustand — Simple, typed client state with minimal boilerplate.
6. Tailwind CSS v4 — Rapid development with utility-first ergonomics.
7. Feature-based organization — Improves cohesion and discoverability.
8. Sentry — Production-grade monitoring and diagnostics.
9. Lightweight Charts™ for price charts — High-performance, minimal bundle, finance-focused interactions. Recharts remains for non-financial analytics.

## Known Limitations

- Server/Client boundary complexity with Server Components
- Potential ecosystem lag for React 19/Next 15 support
- App Router learning curve for new contributors
