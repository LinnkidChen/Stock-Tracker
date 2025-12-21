# 实施计划: K线图表独立页与导航

**分支**: `004-klinechart-chart-page` | **日期**: 2025-12-21 | **规范**: `specs/004-klinechart-chart-page/spec.md`
**输入**: 来自 `/specs/004-klinechart-chart-page/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。执行流程见
`.specify/templates/commands/plan.md`。

## 摘要

- 将图表从仪表盘拆分为独立图表页，并在概览卡片下增加图表导航入口。
- 图表页复用现有 K 线图表能力与行情 API，支持选择/切换标的与状态提示。
- 替换所有 lightweight-charts 价格图表实现，统一为 K 线图表体验。
- 保持现有样式体系，补齐文档、Sentry 追踪与单元测试。

## 技术背景

**语言/版本**: TypeScript 5.7, React 19, Next.js 16 (App Router)  
**核心依赖**: Next.js App Router, @tanstack/react-query, Zustand, klinecharts, Radix UI  
**存储**: N/A（无新增持久化；依赖现有 API 与客户端状态）  
**测试**: Jest + React Testing Library  
**目标平台**: Web（现代浏览器）  
**项目类型**: web  
**性能目标**: 选择有效标的后 2 秒内可见图表（与 SC-002 对齐）  
**约束**: 需登录访问；继续遵守现有行情数据速率限制与缓存策略；移除 lightweight-charts 依赖与相关实现  
**规模/范围**: 仪表盘新增导航入口 + 新图表页 + 统一图表实现（单模块变更）

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：✅ 复用现有 KLineChart 与 API，仅新增图表页与入口。
- 文档已规划：✅ 更新 quickstart.md，并在需要时补充 README/说明。
- 日志与追踪已规划：✅ 关键 UI 行为与错误使用 Sentry spans/exception。
- 单元测试已规划：✅ 覆盖图表页渲染、导航入口、状态提示与标的切换。
- 阶段 0 检查结果：通过。
- 阶段 1 复核结果：通过。

## 项目结构

### 文档（本功能）

```text
specs/004-klinechart-chart-page/
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
│   ├── dashboard/
│   │   ├── stocks/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── charts/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   └── api/
│       └── stocks/
│           ├── kline/[symbol]/route.ts
│           └── quote/[symbol]/route.ts
├── components/
│   └── ui/
├── features/
│   └── stock-dashboard/
│       ├── components/
│       ├── lib/
│       └── store/
└── lib/
    ├── services/
    └── types/

src/features/stock-dashboard/components/__tests__/
```

**结构决策**: 该功能属于 Web 应用，遵循 Next.js App Router 结构，新增页面与复用现有 features 模块。

## 复杂度追踪

无。
