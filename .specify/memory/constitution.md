<!--
同步影响报告
版本变更: 1.0.0 -> 1.0.1
已修改原则:
- I. Rapid Delivery With Safe Defaults -> I. 以安全默认值快速交付
- II. Documentation Is Part of the Feature -> II. 文档是功能的一部分
- III. Detailed Logging and Tracing -> III. 详尽日志与链路追踪
- IV. Comprehensive Unit Tests -> IV. 全面的单元测试
新增章节: 无
移除章节: 无
需要更新的模板:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ pending .specify/templates/commands/*.md (未找到文件)
后续 TODO:
- TODO(RATIFICATION_DATE): 仓库历史中未找到原始通过日期
-->

# Stock Tracker 宪章

## 核心原则

### I. 以安全默认值快速交付

以小步可审查的增量交付，优先选择能带来用户价值的最简单可行方案。
避免臆测式抽象，控制范围并限制研究时间。速度不能绕过文档、日志
或单元测试覆盖。

### II. 文档是功能的一部分

所有面向用户的变更在合并前必须同步更新相关文档（README、规范、
快速开始或功能说明）。记录意图、使用方式与限制，确保新贡献者不需要
通过翻代码理解功能。

### III. 详尽日志与链路追踪

所有关键动作（UI 事件、API 调用、后台任务）必须通过 Sentry 产出结构化
日志与追踪。使用 `Sentry.startSpan` 创建跨度，使用
`Sentry.captureException` 记录可预期错误，使用 Sentry 的 logger 输出结构化
日志；避免随意使用 `console.*`。

### IV. 全面的单元测试

所有新增或修改的逻辑必须有单元测试覆盖，包含主流程、边界与错误处理。
测试必须可重复、隔离，且可在本地无外部依赖运行。

## 实施标准

- 使用 TypeScript，并遵循 Next.js App Router 目录结构（`src/app`）。
- 日志与追踪必须使用 `import * as Sentry from '@sentry/nextjs'`，并复用
  现有 Sentry 初始化文件；不得在其他位置重复初始化。
- 在可预期失败的 try/catch 中使用 `Sentry.captureException(error)`。
- 追踪使用 `Sentry.startSpan`，`op` 与 `name` 必须清晰表达行为，并添加
  相关属性。

## 开发流程

- 先写简明 spec，再写 plan，再写 tasks；快速迭代优先于完美设计。
- 每个功能必须包含：文档更新、详尽日志/追踪、以及单元测试。
- 合并前必须通过 lint 与 build。
- 若违反原则，必须记录例外原因并给出修复计划。

## 治理

- 本宪章优先于其他开发指导文档。
- 修订必须包含变更理由、版本更新，并在 PR 中审阅。
- 版本号遵循语义化：破坏性治理变更为 MAJOR，新增或显著扩展原则为 MINOR，
  文字澄清为 PATCH。
- 计划与代码评审需要检查合规性；违规必须显式批准并创建后续任务恢复合规。

**版本**: 1.0.1 | **通过**: TODO(RATIFICATION_DATE): 仓库历史中未找到原始通过日期 | **最后修订**: 2025-12-21
