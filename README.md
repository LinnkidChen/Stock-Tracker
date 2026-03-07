# Stock Tracker

<div align="center"><strong>全面的股票投资组合分析与指标平台</strong></div>
<div align="center">基于 Next.js 15、React 19、TradingView Lightweight Charts 与 klinecharts 构建</div>
<br />

## 概览

Stock Tracker 是一个全面的股票投资组合分析与指标平台，旨在为投资者提供实时市场洞察与组合表现跟踪。它提供统一的仪表盘，用于监控股票、分析技术指标并支持数据驱动的投资决策。

- 框架 - [Next.js 15](https://nextjs.org/13)
- 语言 - [TypeScript](https://www.typescriptlang.org)
- 认证 - [Clerk](https://go.clerk.com/ILdYhn7)
- 错误追踪 - [<picture><img alt="Sentry" src="public/assets/sentry.svg">
  </picture>](https://sentry.io/for/nextjs/?utm_source=github&utm_medium=paid-community&utm_campaign=general-fy26q2-nextjs&utm_content=github-banner-project-tryfree)
- 样式 - [Tailwind CSS v4](https://tailwindcss.com)
- 组件 - [Shadcn-ui](https://ui.shadcn.com)
- Schema 校验 - [Zod](https://zod.dev)
- 状态管理 - [Zustand](https://zustand-demo.pmnd.rs)
- 搜索参数状态管理 - [Nuqs](https://nuqs.47ng.com/)
- 表格 - [Tanstack Data Tables](https://ui.shadcn.com/docs/components/data-table) • [Dice table](https://www.diceui.com/docs/components/data-table)
- 表单 - [React Hook Form](https://ui.shadcn.com/docs/components/form)
- Command+k 面板 - [kbar](https://kbar.vercel.app/)
- Lint - [ESLint](https://eslint.org)
- 预提交钩子 - [Husky](https://typicode.github.io/husky/)
- 格式化 - [Prettier](https://prettier.io)

- **实时股票仪表盘**：交互式价格图表，支持蜡烛图形态、成交量分析与市场深度
- **技术指标**：RSI、MACD、移动平均、布林带与自定义指标
- **组合管理**：追踪多个投资组合的实时估值与盈亏
- **关注列表与提醒**：可配置关注列表与价格/指标提醒
- **绩效分析**：组合指标、风险分析与市场指数对比

## 技术栈

| 页面                                                                                                                                                                   | 说明                                                                                          |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| [Signup / Signin](https://go.clerk.com/ILdYhn7)                                                                                                                        | 使用 **Clerk** 提供安全认证与用户管理，支持无密码登录、社交登录与企业 SSO，兼顾安全性与体验。 |
| [Dashboard (Overview)](https://shadcn-dashboard.kiranism.dev/dashboard)                                                                                                | 使用 Recharts 的卡片型分析图表。概览页采用并行路由，具备独立加载、错误处理与组件隔离渲染。    |
| [Product](https://shadcn-dashboard.kiranism.dev/dashboard/product)                                                                                                     | 使用 Tanstack tables，支持 Nuqs 管理的服务端搜索、过滤与分页。                                |
| [Product/new](https://shadcn-dashboard.kiranism.dev/dashboard/product/new)                                                                                             | 使用 shadcn 表单（react-hook-form + zod）。                                                   |
| [Profile](https://shadcn-dashboard.kiranism.dev/dashboard/profile)                                                                                                     | 使用 Clerk 完整的账号管理 UI，支持个人资料与安全设置。                                        |
| [Kanban Board](https://shadcn-dashboard.kiranism.dev/dashboard/kanban)                                                                                                 | 使用 dnd-kit + zustand 的拖拽看板，状态本地持久化。                                           |
| [Not Found](https://shadcn-dashboard.kiranism.dev/dashboard/notfound)                                                                                                  | 根级 Not Found 页面。                                                                         |
| [Global Error](https://sentry.io/for/nextjs/?utm_source=github&utm_medium=paid-community&utm_campaign=general-fy26q2-nextjs&utm_content=github-banner-project-tryfree) | 全局错误页面，集中捕获与展示错误。与 **Sentry** 集成以记录错误并提供调试信息。                |

- **框架**: [Next.js 15](https://nextjs.org)（App Router）
- **语言**: [TypeScript](https://www.typescriptlang.org) 5.7.2
- **运行时**: Node.js 20+
- **包管理器**: pnpm

### UI 与可视化

- **样式**: [Tailwind CSS v4](https://tailwindcss.com)
- **组件**: [Shadcn-ui](https://ui.shadcn.com)（Radix UI primitives）
- **金融图表**: [TradingView Lightweight Charts™](https://www.tradingview.com/lightweight-charts/) 与 [klinecharts](https://klinecharts.com) - 价格图表与 K 线图
- **分析图表**: [Recharts](https://recharts.org) - KPI、分布与非金融可视化
- **命令面板**: [kbar](https://kbar.vercel.app/)

### 状态与数据管理

- **客户端状态**: [Zustand](https://zustand-demo.pmnd.rs) v5
- **服务端状态**: 通过 provider 使用 React Query
- **表单**: [React Hook Form](https://ui.shadcn.com/docs/components/form) + [Zod](https://zod.dev)
- **表格**: [Tanstack Data Tables](https://ui.shadcn.com/docs/components/data-table)
- **Search Params**: [Nuqs](https://nuqs.47ng.com/)

### 基础设施与开发体验

- **认证**: [Clerk](https://go.clerk.com/ILdYhn7)
- **数据库**: [Supabase](https://supabase.com) (关注列表持久化)
- **错误追踪**: [Sentry](https://sentry.io/for/nextjs/)
- **Lint**: [ESLint](https://eslint.org)
- **格式化**: [Prettier](https://prettier.io)
- **预提交钩子**: [Husky](https://typicode.github.io/husky/)

## 功能与页面

### 股票分析功能

| 功能               | 描述                                                                                         |
| :----------------- | :------------------------------------------------------------------------------------------- |
| **股票仪表盘**     | 使用 TradingView Lightweight Charts 的实时价格图表，支持蜡烛图形态、成交量指标与技术分析工具 |
| **K 线图 Tab**     | 使用 klinecharts 展示 1 年日 K 线；仅支持单一 ticker，受 Alpha Vantage 限流影响              |
| **投资组合追踪**   | 监控多个组合的实时盈亏、资产配置可视化与绩效指标                                             |
| **技术指标**       | RSI、MACD、移动平均、布林带等综合指标套件                                                    |
| **关注列表与提醒** | 创建关注列表并设置价格提醒与指标提醒                                                         |
| **市场概览**       | 通过交互式可视化跟踪板块表现、市场指数与热门股票                                             |

### 核心仪表盘页面

| 页面                     | 描述                                             |
| :----------------------- | :----------------------------------------------- |
| **Dashboard (Overview)** | 使用 Recharts 的组合总览与市场指数、关键绩效指标 |
| **Stock Details**        | 单只股票分析页面，包含价格图表、指标与公司信息   |
| **Portfolio Management** | 管理持仓、跟踪交易并分析组合绩效                 |
| **Watchlists**           | 创建与管理关注列表，实时更新                     |
| **Settings**             | 用户偏好、提醒配置与 Clerk 账号管理              |
| **Reports**              | 生成投资组合报告并导出数据用于税务               |

## 项目结构

```plaintext
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 认证路由
│   ├── (dashboard)/         # 仪表盘路由
│   │   ├── dashboard/
│   │   │   ├── stocks/      # 股票分析页面
│   │   │   ├── portfolio/   # 组合管理
│   │   │   └── watchlist/   # 关注列表功能
│   └── api/                 # API 路由
│
├── components/              # 共享组件
│   ├── ui/                  # shadcn/ui 组件
│   ├── layout/              # 布局组件
│   └── charts/              # 图表组件
│
├── features/                # 功能模块
│   ├── stock-dashboard/     # 股票分析功能
│   │   ├── components/      # 股票专用组件
│   │   ├── hooks/          # 自定义 hooks
│   │   ├── lib/            # 图表配置
│   │   └── types/          # TypeScript 类型
│   ├── portfolio/          # 投资组合管理
│   ├── watchlist/          # 关注列表功能
│   └── overview/           # 仪表盘概览
│
├── lib/                    # 核心工具
│   ├── auth/              # Clerk 配置
│   ├── api/               # API 客户端
│   └── utils/             # 共享工具
│
├── hooks/                  # 全局自定义 hooks
├── stores/                 # Zustand stores
└── types/                  # 全局 TypeScript 类型
```

## 快速开始

### 前置条件

- Node.js 20+
- pnpm 包管理器
- Git

### 安装

1. 克隆仓库:

```bash
git clone https://github.com/your-username/stock-tracker.git
cd stock-tracker
```

2. 安装依赖:

```bash
pnpm install
```

3. 配置环境变量:

```bash
cp env.example.txt .env.local
```

4. 在 `.env.local` 中配置：

   - Clerk 认证密钥（初始化可选）
   - Sentry DSN（可选）。设置 `NEXT_PUBLIC_SENTRY_DISABLED=true` 可禁用。
   - Alpha Vantage API Key（准备接入真实数据时）。注意：免费额度 5 次/分钟。
   - Longbridge API Config（如需使用 Longbridge 数据源）：`LONGPORT_APP_KEY`, `LONGPORT_APP_SECRET`, `LONGPORT_ACCESS_TOKEN`.
   - Supabase Config (用于关注列表持久化): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - 关注列表认证集成：Clerk 中必须存在名为 `supabase` 的 JWT template，且 Supabase 必须配置为验证 Clerk 签发的 JWT。

5. 启动开发服务:

```bash
pnpm dev
```

应用将运行在 http://localhost:3000

### 关注列表认证说明

关注列表接口依赖 Supabase Row Level Security，并假设请求里的 JWT 满足：

- JWT 来自 Clerk 的 `supabase` template
- JWT 的 `sub` 等于 Clerk user id
- Supabase 已配置为信任并验证 Clerk 签发的 JWT

如果缺少以上配置，`/api/watchlist` 现在会返回 `503`，并带上稳定错误码 `WATCHLIST_AUTH_MISCONFIGURED`，而不是继续回退到不被 Supabase 接受的默认 Clerk token。

### 开发命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器
pnpm lint         # 运行 ESLint
pnpm lint:fix     # 修复 lint 问题
pnpm format       # 使用 Prettier 格式化代码
pnpm format:check # 校验格式
```

## 规范驱动开发

本项目使用结构化规范流程进行功能开发，规范位于 `.spec-workflow/` 目录。

### 当前规范

- **stock-dashboard-page**: 股票分析仪表盘实现（25 个任务已完成）
- **stocks-only-cleanup**: 股票相关功能清理（7 个任务已完成）
