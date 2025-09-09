# Stock Tracker

<div align="center"><strong>Comprehensive Stock Portfolio Analyzer & Indicator Platform</strong></div>
<div align="center">Built with Next.js 15, React 19, and TradingView Lightweight Charts</div>
<br />

## Overview

Stock Tracker is a comprehensive stock portfolio analyzer and indicator platform designed to empower investors with real-time market insights and portfolio performance tracking. It provides a unified dashboard for monitoring stocks, analyzing technical indicators, and making data-driven investment decisions.

- Framework - [Next.js 15](https://nextjs.org/13)
- Language - [TypeScript](https://www.typescriptlang.org)
- Auth - [Clerk](https://go.clerk.com/ILdYhn7)
- Error tracking - [<picture><img alt="Sentry" src="public/assets/sentry.svg">
  </picture>](https://sentry.io/for/nextjs/?utm_source=github&utm_medium=paid-community&utm_campaign=general-fy26q2-nextjs&utm_content=github-banner-project-tryfree)
- Styling - [Tailwind CSS v4](https://tailwindcss.com)
- Components - [Shadcn-ui](https://ui.shadcn.com)
- Schema Validations - [Zod](https://zod.dev)
- State Management - [Zustand](https://zustand-demo.pmnd.rs)
- Search params state manager - [Nuqs](https://nuqs.47ng.com/)
- Tables - [Tanstack Data Tables](https://ui.shadcn.com/docs/components/data-table) • [Dice table](https://www.diceui.com/docs/components/data-table)
- Forms - [React Hook Form](https://ui.shadcn.com/docs/components/form)
- Command+k interface - [kbar](https://kbar.vercel.app/)
- Linting - [ESLint](https://eslint.org)
- Pre-commit Hooks - [Husky](https://typicode.github.io/husky/)
- Formatting - [Prettier](https://prettier.io)

- **Real-time Stock Dashboard**: Interactive price charts with candlestick patterns, volume analysis, and market depth
- **Technical Indicators**: RSI, MACD, Moving Averages, Bollinger Bands, and custom indicators
- **Portfolio Management**: Track multiple portfolios with real-time valuation and P&L calculations
- **Watchlist & Alerts**: Customizable watchlists with price alerts and indicator-based notifications
- **Performance Analytics**: Portfolio metrics, risk analysis, and comparison against market indices

## Technology Stack

| Pages                                                                                                                                                                  | Specifications                                                                                                                                                                                                                                                          |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Signup / Signin](https://go.clerk.com/ILdYhn7)                                                                                                                        | Authentication with **Clerk** provides secure authentication and user management with multiple sign-in options including passwordless authentication, social logins, and enterprise SSO - all designed to enhance security while delivering a seamless user experience. |
| [Dashboard (Overview)](https://shadcn-dashboard.kiranism.dev/dashboard)                                                                                                | Cards with Recharts graphs for analytics. Parallel routes in the overview sections feature independent loading, error handling, and isolated component rendering.                                                                                                       |
| [Product](https://shadcn-dashboard.kiranism.dev/dashboard/product)                                                                                                     | Tanstack tables with server side searching, filter, pagination by Nuqs which is a Type-safe search params state manager in nextjs                                                                                                                                       |
| [Product/new](https://shadcn-dashboard.kiranism.dev/dashboard/product/new)                                                                                             | A Product Form with shadcn form (react-hook-form + zod).                                                                                                                                                                                                                |
| [Profile](https://shadcn-dashboard.kiranism.dev/dashboard/profile)                                                                                                     | Clerk's full-featured account management UI that allows users to manage their profile and security settings                                                                                                                                                             |
| [Kanban Board](https://shadcn-dashboard.kiranism.dev/dashboard/kanban)                                                                                                 | A Drag n Drop task management board with dnd-kit and zustand to persist state locally.                                                                                                                                                                                  |
| [Not Found](https://shadcn-dashboard.kiranism.dev/dashboard/notfound)                                                                                                  | Not Found Page Added in the root level                                                                                                                                                                                                                                  |
| [Global Error](https://sentry.io/for/nextjs/?utm_source=github&utm_medium=paid-community&utm_campaign=general-fy26q2-nextjs&utm_content=github-banner-project-tryfree) | A centralized error page that captures and displays errors across the application. Integrated with **Sentry** to log errors, provide detailed reports, and enable replay functionality for better debugging.                                                            |

- **Framework**: [Next.js 15](https://nextjs.org) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org) 5.7.2
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm

### UI & Visualization

- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Components**: [Shadcn-ui](https://ui.shadcn.com) (Radix UI primitives)
- **Financial Charts**: [TradingView Lightweight Charts™](https://www.tradingview.com/lightweight-charts/) - For stock price charts, candlesticks, and volume
- **Analytics Charts**: [Recharts](https://recharts.org) - For KPIs, distributions, and non-financial visualizations
- **Command Palette**: [kbar](https://kbar.vercel.app/)

### State & Data Management

- **Client State**: [Zustand](https://zustand-demo.pmnd.rs) v5
- **Server State**: React Query via provider
- **Forms**: [React Hook Form](https://ui.shadcn.com/docs/components/form) + [Zod](https://zod.dev)
- **Tables**: [Tanstack Data Tables](https://ui.shadcn.com/docs/components/data-table)
- **Search Params**: [Nuqs](https://nuqs.47ng.com/)

### Infrastructure & DX

- **Auth**: [Clerk](https://go.clerk.com/ILdYhn7)
- **Error Tracking**: [Sentry](https://sentry.io/for/nextjs/)
- **Linting**: [ESLint](https://eslint.org)
- **Formatting**: [Prettier](https://prettier.io)
- **Pre-commit Hooks**: [Husky](https://typicode.github.io/husky/)


## Features & Pages

### Stock Analysis Features

| Feature | Description |
| :------ | :---------- |
| **Stock Dashboard** | Real-time stock price charts with TradingView Lightweight Charts, featuring candlestick patterns, volume indicators, and technical analysis tools |
| **Portfolio Tracker** | Monitor multiple portfolios with real-time P&L, asset allocation visualization, and performance metrics |
| **Technical Indicators** | Comprehensive indicator suite including RSI, MACD, Moving Averages, Bollinger Bands for informed trading decisions |
| **Watchlist & Alerts** | Create custom watchlists and set price alerts with indicator-based notifications |
| **Market Overview** | Track sector performance, market indices, and trending stocks with interactive visualizations |

### Core Dashboard Pages

| Page | Description |
| :--- | :---------- |
| **Dashboard (Overview)** | Main dashboard with portfolio summary, market indices, and key performance metrics using Recharts |
| **Stock Details** | Individual stock analysis page with price charts, indicators, and company information |
| **Portfolio Management** | Manage holdings, track transactions, and analyze portfolio performance |
| **Watchlists** | Create and manage custom stock watchlists with real-time updates |
| **Settings** | User preferences, alert configurations, and account management via Clerk |
| **Reports** | Generate portfolio reports and export data for tax purposes |

## Project Structure

```plaintext
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes
│   ├── (dashboard)/         # Dashboard routes
│   │   ├── dashboard/
│   │   │   ├── stocks/      # Stock analysis pages
│   │   │   ├── portfolio/   # Portfolio management
│   │   │   └── watchlist/   # Watchlist features
│   └── api/                 # API routes
│
├── components/              # Shared components
│   ├── ui/                  # shadcn/ui components
│   ├── layout/              # Layout components
│   └── charts/              # Chart components
│
├── features/                # Feature modules
│   ├── stock-dashboard/     # Stock analysis features
│   │   ├── components/      # Stock-specific components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Chart configurations
│   │   └── types/          # TypeScript types
│   ├── portfolio/          # Portfolio management
│   ├── watchlist/          # Watchlist features
│   └── overview/           # Dashboard overview
│
├── lib/                    # Core utilities
│   ├── auth/              # Clerk configuration
│   ├── api/               # API clients
│   └── utils/             # Shared utilities
│
├── hooks/                  # Global custom hooks
├── stores/                 # Zustand stores
└── types/                  # Global TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 20+ 
- pnpm package manager
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/stock-tracker.git
cd stock-tracker
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp env.example.txt .env.local
```

4. Configure your `.env.local` file with:
   - Clerk authentication keys (optional for initial setup)
   - Sentry DSN for error tracking (optional)
   - Stock API keys (when ready for real data)

5. Run the development server:
```bash
pnpm dev
```

The application will be available at http://localhost:3000

### Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix linting issues
pnpm format       # Format code with Prettier
pnpm format:check # Check formatting
```

## Specification-Driven Development

This project uses a structured specification workflow for feature development. Specifications are managed in the `.spec-workflow/` directory.

### Current Specifications

- **stock-dashboard-page**: Complete stock analysis dashboard implementation (25 tasks completed)
- **stocks-only-cleanup**: Focused cleanup for stock-specific features (7 tasks completed)

### Workflow Process

1. **Requirements Phase**: Define EARS-format requirements
2. **Design Phase**: Create technical design documents
3. **Tasks Phase**: Generate actionable implementation tasks
4. **Implementation Phase**: Execute tasks with progress tracking

For more details, see the `.spec-workflow/` directory.

## Contributing

Please follow these guidelines when contributing:

1. **Code Style**: Follow TypeScript/TSX standards with Prettier formatting
2. **Commits**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`)
3. **Testing**: Ensure `pnpm lint` and `pnpm build` pass
4. **Documentation**: Update relevant docs for new features

## Security Notes

- Never commit `.env` files or secrets
- Use environment variables for all sensitive data
- Follow Clerk's security best practices for authentication
- Implement proper data validation for all user inputs

## License

[MIT License](LICENSE)
