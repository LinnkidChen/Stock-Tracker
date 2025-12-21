# 实施计划: Overview 添加 Ticker 错误弹窗

**分支**: `001-ticker-error-modal` | **日期**: 2025-12-21 | **规范**: /Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/spec.md
**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/spec.md` 的功能规范

## 摘要

为 Dashboard 的“添加 ticker”流程提供更详细的失败原因展示，并通过弹窗提示用户下一步操作。实现上复用现有 Modal 组件，建立统一的错误分类与文案映射（本地校验、重复、服务端错误、网络问题、兜底），并保持输入值不丢失。补充 Sentry spans/logs 与异常捕获，添加可重复的单元与组件测试，更新 quickstart 文档以覆盖手动验证步骤。

## 技术背景

**Language/Version**: TypeScript 5.7, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Next.js App Router, React, Zustand, Radix UI Dialog, Sentry
**Storage**: In-memory watchlist (`/Users/tongchen/Projects/Stock-Tracker/src/app/api/watchlist/route.ts`), no external persistence
**Project Type**: web

**语言/版本**: TypeScript 5.7、React 19、Next.js 16 (App Router)
**核心依赖**: Next.js App Router、React、Zustand、Radix UI Dialog、Sentry
**存储**: 内存型 watchlist（`/Users/tongchen/Projects/Stock-Tracker/src/app/api/watchlist/route.ts`），无外部持久化
**测试**: Jest + React Testing Library
**目标平台**: Web（现代浏览器）+ Node.js server runtime
**项目类型**: web
**性能目标**: 失败发生后 1 秒内显示弹窗
**约束**: 使用 Sentry spans/logs 与 `Sentry.captureException`，避免 `console.*`；错误提示不暴露内部细节；失败时保留输入值
**规模/范围**: 限于 Dashboard 添加 ticker 的前端体验与错误提示，无新增持久化

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：复用现有组件与校验逻辑，范围限定在弹窗与文案映射。
- 文档已规划：更新 `/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/quickstart.md` 与规范文档；无新增 README 变更。
- 日志与追踪已规划：UI 提交与 API 调用增加 Sentry spans，失败路径用 `Sentry.captureException` 与结构化日志记录分类。
- 单元测试已规划：增加错误映射与弹窗行为的单元/组件测试。

**设计后复核 (Phase 1)**: 通过（无宪章违规项）

## 项目结构

### 文档（本功能）

```text
/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # 阶段 0 输出（/speckit.plan 输出）
├── data-model.md        # 阶段 1 输出（/speckit.plan 输出）
├── quickstart.md        # 阶段 1 输出（/speckit.plan 输出）
├── contracts/           # 阶段 1 输出（/speckit.plan 输出）
│   └── watchlist-post.yaml
└── tasks.md             # 阶段 2 输出（/speckit.tasks 输出 - 不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

```text
/Users/tongchen/Projects/Stock-Tracker/src/
├── app/
│   ├── dashboard/stocks/page.tsx
│   └── api/watchlist/route.ts
├── components/
│   ├── ui/modal.tsx
│   └── modal/alert-modal.tsx
├── features/stock-dashboard/components/
│   ├── DashboardClient.tsx
│   ├── TickerInput.tsx
│   └── WatchlistCard.tsx
└── lib/validation/ticker.ts
```

**结构决策**: 采用现有 Next.js App Router Web 应用结构，功能逻辑在 `/Users/tongchen/Projects/Stock-Tracker/src/features`，通用 UI 在 `/Users/tongchen/Projects/Stock-Tracker/src/components`。
