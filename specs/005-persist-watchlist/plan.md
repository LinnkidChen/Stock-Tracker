# 实施计划: 自选列表持久化

**分支**: `005-persist-watchlist` | **日期**: 2025-12-22 | **规范**: `/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/spec.md`
**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。执行流程见
`.specify/templates/commands/plan.md`。

## 摘要

将自选列表从进程内存持久化为用户级别的长期存储：
- 以 Clerk 用户身份为边界保存/读取自选列表，保持用户隔离与一致性
- 为 /api/watchlist 增加读取能力（GET）并更新现有写入（POST）以落库
- 在前端初始加载时拉取已保存列表，保留当前交互与错误反馈
- 为 API 与关键交互补齐 Sentry spans、日志与异常捕获
- 更新 quickstart/README 说明与新增/调整的单元测试

## 技术背景

**语言/版本**: TypeScript 5.7  
**Language/Version**: TypeScript 5.7  
**核心依赖**: Next.js 16 (App Router), React 19, Clerk, Sentry, Supabase JS  
**Primary Dependencies**: Next.js 16 (App Router), React 19, @clerk/nextjs, @sentry/nextjs, @supabase/supabase-js  
**存储**: Supabase Postgres（stock_watchlist_items）  
**Storage**: Supabase Postgres (stock_watchlist_items)  
**测试**: Jest + React Testing Library  
**Testing**: Jest + React Testing Library  
**目标平台**: Web (Next.js server + browser)  
**Target Platform**: Web (Next.js server + browser)  
**项目类型**: web  
**Project Type**: web  
**性能目标**: 95% 用户在 2 秒内看到自选列表  
**Performance Goals**: 95% of sessions load the watchlist within 2 seconds  
**约束**: 使用 Clerk 身份进行数据隔离；不引入分享/协作/推荐等新功能  
**Constraints**: Use Clerk identity for data isolation; no new features beyond watchlist persistence  
**规模/范围**: Dashboard 自选列表功能范围  
**Scale/Scope**: Dashboard watchlist only; per-user list

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：仅替换 watchlist 的存储层与加载流程，保持现有交互范围。
- 文档已规划：更新 `/Users/tongchen/Projects/Stock-Tracker-2/README.md` 与 `/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/quickstart.md`。
- 日志与追踪已规划：为 /api/watchlist 的读取与写入添加 Sentry span/log；在前端初始加载处补齐 span。
- 单元测试已规划：新增 API 路由测试与更新 WatchlistCard 相关测试覆盖加载与失败场景。

**门禁结果**: 通过（无违规项）。  
**复核结果**: 阶段 1 设计完成后复核通过。

## 项目结构

### 文档（本功能）

```text
/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 源码（仓库根目录）

```text
/Users/tongchen/Projects/Stock-Tracker-2/src/
├── app/
│   ├── api/watchlist/route.ts
│   └── dashboard/stocks/page.tsx
├── features/
│   └── stock-dashboard/
│       └── components/WatchlistCard.tsx
├── lib/
│   └── [新增] supabase/...
└── types/

/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/
├── watchlist-card.test.tsx
└── WatchlistCard.integration.test.tsx
```

**结构决策**: 该功能为 Next.js App Router 单体 Web 应用，API 路由与 UI 共仓；持久化逻辑放在 server route，UI 只负责调用与展示。
