# 实施计划: 股票 K 线图 Tab

**分支**: `[002-kline-chart-tab]` | **日期**: 2025-12-21 | **规范**: /Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/spec.md  
**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。

## 摘要

在股票详情页加入图表 Tab 切换，第二个 Tab 使用 klinecharts 展示所选 ticker 的 1 年日 K 线；支持加载、无数据、失败提示与重试；ticker 切换触发图表刷新；通过 Sentry spans/logs/异常捕获记录关键行为与失败；补充文档与测试以满足宪章要求。

## 技术背景

**语言/版本**: TypeScript 5.7，React 19，Next.js 16（App Router）  
**核心依赖**: Next.js、React、Tailwind CSS、Radix UI Tabs、Zustand、@tanstack/react-query、@sentry/nextjs、klinecharts（新增）、Alpha Vantage（现有服务）  
**存储**: 无持久化数据库；客户端状态 + sessionStorage  
**测试**: Jest + React Testing Library（`pnpm test`）  
**目标平台**: Web（现代浏览器）  
**项目类型**: Web 应用（Next.js App Router）  
**性能目标**: 95% 的图表在 2 秒内可见；ticker 切换 3 秒内完成刷新；交互保持 60fps 体验  
**约束**: 必须使用 klinecharts；遵循 ticker 校验规则；遵循 Alpha Vantage 限流（5 次/分钟）与 10s 超时；使用 Sentry spans/logs/异常捕获；不支持多 ticker 对比与指标叠加  
**规模/范围**: 单 ticker、默认 1 年日 K、单页面新增 Tab

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：复用现有 ticker 选择、API 响应与错误处理模式；不引入多标的对比、指标叠加等扩展能力。
- 文档已规划：更新 `/Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/quickstart.md`，如需用户可见说明则补充 `/Users/tongchen/Projects/Stock-Tracker-1/README.md`。
- 日志与追踪已规划：在 UI Tab 打开、ticker 切换、加载失败以及 API 请求处添加 Sentry span/log/captureException。
- 单元测试已规划：新增 API route 与 hook/组件的 Jest 测试覆盖主流程、无数据与错误场景。
- Post-design check: 设计产物已生成且与宪章一致（research/data-model/contracts/quickstart）。

## 项目结构

### 文档（本功能）

```text
/Users/tongchen/Projects/Stock-Tracker-1/specs/002-kline-chart-tab/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # 阶段 0 输出（/speckit.plan 输出）
├── data-model.md        # 阶段 1 输出（/speckit.plan 输出）
├── quickstart.md        # 阶段 1 输出（/speckit.plan 输出）
├── contracts/           # 阶段 1 输出（/speckit.plan 输出）
└── tasks.md             # 阶段 2 输出（/speckit.tasks 输出 - 不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

```text
/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/route.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/route.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/DashboardClient.tsx
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/PriceChart.tsx
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/StockChartTabs.tsx
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/components/KLineChart.tsx
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/hooks/useKlineSeries.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/features/stock-dashboard/lib/klinecharts.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/lib/services/alpha-vantage-client.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/lib/services/stock-service.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/lib/types/stock-api.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/lib/validation/ticker.ts
/Users/tongchen/Projects/Stock-Tracker-1/src/components/ui/tabs.tsx
```

**结构决策**: Web 应用，遵循 Next.js App Router 与 feature 模块组织；API 新增在 `src/app/api/stocks`，UI 组件与 hooks 放在 `src/features/stock-dashboard`。
