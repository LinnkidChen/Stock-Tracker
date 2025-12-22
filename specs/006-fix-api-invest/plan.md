# 实施计划: 修复行情 API 行为漂移

**分支**: `006-fix-api-invest` | **日期**: 2025-12-22 | **规范**: /Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/spec.md
**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。执行流程见
`.specify/templates/commands/plan.md`。

## 摘要

围绕报价与 K 线 API 的一致性，修复测试与实现的行为漂移：确保数据来源解析与默认行为一致、请求缺少 URL 信息时可控返回错误、并更新单元测试与契约以覆盖成功与错误路径。同时为报价路由补齐 Sentry 追踪与异常捕获，满足宪章的日志与可观测性要求。

## 技术背景

**语言/版本**: TypeScript 5.7.2  
**核心依赖**: Next.js 16 (App Router), React 19, Sentry, Jest  
**存储**: N/A（本功能不涉及持久化）  
**测试**: Jest + Testing Library  
**目标平台**: Web (Next.js server runtime)  
**项目类型**: web  
**性能目标**: 无新增指标，保持现有 API 响应体验  
**约束**: 测试需本地可离线运行；不引入新的外部依赖  
**规模/范围**: 仅覆盖报价与 K 线 API 路由及其单元测试

## 宪章检查

*门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。*

- 以安全默认值快速交付：仅修复测试/实现一致性并补齐可观测性。
- 文档已规划：补充 `specs/006-fix-api-invest/quickstart.md`，同步本功能验证步骤。
- 日志与追踪已规划：报价路由补齐 Sentry span 与异常捕获，保留结构化 logger。
- 单元测试已规划：更新报价与 K 线路由测试以覆盖默认 provider、错误映射与 URL 缺失处理。

**设计后复核**: 通过（无新增依赖或范围扩张）。

## 项目结构

### 文档（本功能）

```text
/Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 源码（仓库根目录）

```text
/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/
└── route.ts

/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/
└── route.ts

/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/
└── route.test.ts

/Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/
└── route.test.ts

/Users/tongchen/Projects/Stock-Tracker-1/src/lib/services/
└── stock-service.ts

/Users/tongchen/Projects/Stock-Tracker-1/src/lib/validation/
└── ticker.ts
```

**结构决策**: 本功能为 Web API 路由修复，沿用 Next.js App Router 结构与现有测试位置。
