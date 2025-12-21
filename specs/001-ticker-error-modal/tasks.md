# 任务: Overview 添加 Ticker 错误弹窗

**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/` 的设计文档
**前置条件**: plan.md（必需）、spec.md（用户故事必需）、research.md、data-model.md、contracts/
**测试**: 本任务列表包含单元/组件测试任务（NFR-003 + 宪章要求）。
**组织方式**: 任务按用户故事分组，以便每个故事可独立实现与测试。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（例如 US1、US2、US3）
- 描述中需包含精确文件路径

## 阶段 1：初始化（共享基础）

**目的**: 建立错误展示与映射的基础结构

- [X] T001 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/add-ticker-error.ts` 定义 `AddTickerError` 类型与基础文案常量
- [X] T002 [P] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/TickerErrorModal.tsx` 创建错误弹窗组件壳（接收标题、描述、下一步与关闭回调）

---

## 阶段 2：基础设施（阻塞性前置）

**目的**: 所有用户故事共享的错误映射与测试基础

**⚠️ 关键**: 未完成本阶段不得开始用户故事

- [X] T003 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/add-ticker-error.ts` 增加 `getAddTickerError` 基础接口与兜底返回结构
- [X] T004 [P] 在 `/Users/tongchen/Projects/Stock-Tracker/src/test-setup.ts` 增加 `@sentry/nextjs` 的测试 mock（确保 spans/logger 在测试中可用）

**检查点**: Foundation 完成后，可并行开始用户故事实现

---

## 阶段 3：用户故事 1 - 失败原因清晰弹窗（优先级: P1）🎯 MVP

**目标**: 本地校验与重复添加时展示清晰弹窗与可执行下一步

**独立测试**: 通过无效输入与重复 ticker 触发弹窗，验证提示内容与输入保留

### 用户故事 1 的测试（必需）⚠️

- [X] T005 [P] [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts` 添加校验失败与重复添加的错误映射单测
- [X] T006 [P] [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/ticker-error-modal.test.tsx` 添加弹窗渲染/关闭行为单测
- [X] T007 [P] [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx` 添加校验失败与重复添加的弹窗流程测试（mock fetch）

### 用户故事 1 的实现

- [X] T008 [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/add-ticker-error.ts` 实现校验失败与重复添加的错误映射与文案
- [X] T009 [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/TickerErrorModal.tsx` 实现标题/描述/下一步的展示与关闭按钮
- [X] T010 [US1] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/WatchlistCard.tsx` 接入弹窗与错误映射（校验+重复），失败时保留输入并移除内联错误，添加提交阶段 `Sentry.startSpan` 与结构化日志

**检查点**: 用户故事 1 应可独立运行并通过测试

---

## 阶段 4：用户故事 2 - 暂时不可用提示（优先级: P2）

**目标**: 连接问题或限流时提供明确弹窗与重试指引

**独立测试**: 模拟 429 与网络失败，验证弹窗文案与下一步提示

### 用户故事 2 的测试（必需）⚠️

- [X] T011 [P] [US2] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts` 添加限流与网络失败的错误映射单测
- [X] T012 [P] [US2] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx` 添加 429 与网络失败的弹窗流程测试（mock fetch）

### 用户故事 2 的实现

- [X] T013 [US2] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/add-ticker-error.ts` 增加限流与网络失败的错误映射与文案
- [X] T014 [US2] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/WatchlistCard.tsx` 将 429 与 fetch 失败映射到弹窗，并为 API 调用增加子 span 与 `Sentry.captureException`

**检查点**: 用户故事 2 应可独立运行并通过测试

---

## 阶段 5：用户故事 3 - 未知错误兜底（优先级: P3）

**目标**: 未知失败时提供友好兜底提示与下一步操作

**独立测试**: 模拟未知错误并验证弹窗显示兜底文案

### 用户故事 3 的测试（必需）⚠️

- [X] T015 [P] [US3] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts` 添加未知错误兜底映射单测
- [X] T016 [P] [US3] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx` 添加未知错误弹窗流程测试（mock fetch）

### 用户故事 3 的实现

- [X] T017 [US3] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/add-ticker-error.ts` 增加未知错误兜底文案与默认映射

**检查点**: 用户故事 3 应可独立运行并通过测试

---

## 阶段 6：打磨与跨领域关注点

**目的**: 影响多个用户故事的改进与验收

- [X] T018 [P] 在 `/Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/WatchlistCard.tsx` 校准输入提示/帮助文案与弹窗指引一致
- [X] T019 [P] 在 `/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/quickstart.md` 更新验证步骤以匹配最终行为
- [X] T020 在 `/Users/tongchen/Projects/Stock-Tracker/specs/001-ticker-error-modal/quickstart.md` 记录手动验证结果（包含无效输入、重复、限流/网络、未知兜底）

---

## 依赖与执行顺序

### 阶段依赖

- **初始化（阶段 1）**: 无依赖，可立即开始
- **基础设施（阶段 2）**: 依赖初始化完成 - 阻塞所有用户故事
- **用户故事（阶段 3+）**: 依赖基础设施完成
- **打磨（阶段 6）**: 依赖所有目标用户故事完成

### 用户故事依赖图

- **US1 (P1)** → **US2 (P2)** → **US3 (P3)**

### 每个用户故事内

- 测试必须先写并失败，再实现
- 先错误映射，再 UI 接入
- 完成当前故事后再进入下一个优先级

### 并行机会

- 阶段 1 内标记 [P] 的任务可并行
- 阶段 2 内标记 [P] 的任务可并行
- 同一故事内标记 [P] 的测试可并行

---

## 并行示例：用户故事 1

```bash
任务: "Add validation/duplicate mapping tests in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts"
任务: "Add modal behavior tests in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/ticker-error-modal.test.tsx"
任务: "Add watchlist validation/duplicate flow tests in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx"
```

---

## 并行示例：用户故事 2

```bash
任务: "Add rate limit/network mapping tests in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts"
任务: "Add 429/network modal flow tests in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx"
```

---

## 并行示例：用户故事 3

```bash
任务: "Add unknown fallback mapping test in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/lib/__tests__/add-ticker-error.test.ts"
任务: "Add unknown error modal flow test in /Users/tongchen/Projects/Stock-Tracker/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：初始化
2. 完成阶段 2：基础设施
3. 完成阶段 3：用户故事 1
4. **停止并验证**：独立测试用户故事 1
5. 视情况继续推进 US2/US3 与打磨阶段
