# 实施计划: [FEATURE]

**分支**: `[###-feature-name]` | **日期**: [DATE] | **规范**: [link]
**输入**: 来自 `/specs/[###-feature-name]/spec.md` 的功能规范

**说明**: 此模板由 `/speckit.plan` 命令填充。执行流程见
`.specify/templates/commands/plan.md`。

## 摘要

[从功能规范提取：主要需求 + 技术方案（基于调研）]

## 技术背景

<!--
  需要替换：用项目的技术细节替换本段。
  结构仅作为指导。
-->

**语言/版本**: [例如：Python 3.11、Swift 5.9、Rust 1.75 或 NEEDS CLARIFICATION]  
**核心依赖**: [例如：FastAPI、UIKit、LLVM 或 NEEDS CLARIFICATION]  
**存储**: [如适用，例如 PostgreSQL、CoreData、文件或 N/A]  
**测试**: [例如 pytest、XCTest、cargo test 或 NEEDS CLARIFICATION]  
**目标平台**: [例如 Linux server、iOS 15+、WASM 或 NEEDS CLARIFICATION]
**项目类型**: [single/web/mobile - 决定源码结构]  
**性能目标**: [领域指标，如 1000 req/s、10k lines/sec、60 fps 或 NEEDS CLARIFICATION]  
**约束**: [领域约束，如 <200ms p95、<100MB 内存、离线可用或 NEEDS CLARIFICATION]  
**规模/范围**: [领域范围，如 10k 用户、1M LOC、50 屏或 NEEDS CLARIFICATION]

## 宪章检查

_门禁：必须在阶段 0 调研前通过。阶段 1 设计后再次检查。_

- 以安全默认值快速交付：范围小、分阶段、避免过度抽象。
- 文档已规划：明确 README/spec/quickstart 等更新项、责任人与时间点。
- 日志与追踪已规划：标注 Sentry spans、logs、异常捕获位置。
- 单元测试已规划：为新增/修改逻辑定义全面的单测覆盖。

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

<!--
  需要替换：将下方占位结构替换为本功能的实际结构。
  删除未使用选项，并在保留的结构中补充真实路径。
  最终计划中不能出现 Option 标签。
-->

```text
# [REMOVE IF UNUSED] 选项 1: 单体项目（默认）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] 选项 2: Web 应用（检测到“frontend + backend”时）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] 选项 3: 移动端 + API（检测到 iOS/Android 时）
api/
└── [同上 backend]

ios/ 或 android/
└── [平台特定结构：功能模块、UI 流、平台测试]
```

**结构决策**: [说明选择的结构，并引用上方真实目录]

## 复杂度追踪

> **仅当宪章检查存在违规且需要说明时填写**

| 违规项                     | 必要性     | 被拒绝的更简单替代方案   |
| -------------------------- | ---------- | ------------------------ |
| [例如：第 4 个项目]        | [当前需求] | [为什么 3 个项目不够]    |
| [例如：Repository pattern] | [具体问题] | [为什么直接 DB 访问不够] |
