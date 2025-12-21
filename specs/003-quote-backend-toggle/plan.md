# 实施计划: 行情数据源切换

**分支**: `[003-quote-backend-toggle]` | **日期**: 2025-12-21 | **规范**: `/Users/tongchen/Projects/Stock-Tracker-2/specs/003-quote-backend-toggle/spec.md`
**输入**: 来自 `/specs/003-quote-backend-toggle/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。执行流程见
`.specify/templates/commands/plan.md`。

## 摘要

- 新增全局行情数据源切换控件（默认/Longbridge），展示当前选择并持久化到 localStorage。
- API 抽象为可扩展的 provider 层，通过单一 quote endpoint 支持 provider 参数。
- 在失败/不支持场景提供清晰错误与“重试/切换并重试”，并补齐 Sentry 追踪与单测。
- 更新 quickstart/README 说明数据源与配置方式。

## 技术背景

**语言/版本**: TypeScript 5.7 (React 19, Next.js 16 App Router)  
**核心依赖**: Next.js App Router, React Query, Zustand, Radix UI, Sentry  
**存储**: localStorage（quoteProvider 偏好），服务端无持久化（现有内存存储）  
**测试**: Jest + React Testing Library  
**目标平台**: 现代浏览器 Web  
**项目类型**: Web 应用（Next.js App Router）  
**性能目标**: 切换数据源 10 秒内看到更新结果；失败恢复 30 秒内完成  
**约束**: 不暴露 Longbridge 凭据；不自动切换；仅本地持久化  
**规模/范围**: 单一 Web 应用，面向常规交互负载

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：先切换 + 立即生效 + 持久化，再补失败恢复与扩展点。
- 文档已规划：更新 `README.md` 与 `/specs/003-quote-backend-toggle/quickstart.md`，说明数据源用途、配置与限制。
- 日志与追踪已规划：UI 切换按钮、quote fetch、API provider 分发、失败分支用 Sentry spans + captureException。
- 单元测试已规划：provider store 持久化、API route provider 分发、hooks 查询 key/错误状态。

## 项目结构

### 文档（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # 阶段 0 输出（/speckit.plan 输出）
├── data-model.md        # 阶段 1 输出（/speckit.plan 输出）
├── quickstart.md        # 阶段 1 输出（/speckit.plan 输出）
├── contracts/           # 阶段 1 输出（/speckit.plan 输出）
└── tasks.md             # 阶段 2 输出（/speckit.tasks 输出 - 不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── api/
│   │   └── stocks/
│   │       └── quote/
│   │           └── [symbol]/route.ts
│   └── layout.tsx
├── components/
│   └── layout/
├── features/
│   └── stock-dashboard/
│       ├── components/
│       ├── hooks/
│       └── store.ts
├── lib/
│   ├── logger.ts
│   ├── services/
│   └── types/
└── types/
```

**结构决策**: Next.js App Router 单体 Web 应用，API routes 与前端共存于 `src/app`，业务逻辑在 `src/lib` 与 `src/features`。
