---

description: "功能实现的任务列表"
---

# 任务: 修复行情 API 行为漂移

**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/` 的设计文档
**前置条件**: plan.md（必需）、spec.md（用户故事必需）、research.md、data-model.md、contracts/

**测试**: 功能规范要求新增或修改逻辑必须包含单元测试，任务列表已包含相应测试项。

**组织方式**: 任务按用户故事分组，以便每个故事可独立实现与测试。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（例如 US1、US2、US3）
- 描述中需包含精确文件路径

## 阶段 1：初始化（共享基础）

**目的**: 项目初始化与基础结构

- [x] T001 [P] 对齐 API 契约与当前需求，更新 /Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/contracts/stocks-api.yaml

---

## 阶段 2：基础设施（阻塞性前置）

**目的**: 在任何用户故事开始之前必须完成的核心基础设施

**⚠️ 关键**: 未完成本阶段不得开始用户故事

- [x] T002 创建路由测试请求构造器，新增 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/__tests__/request-fixtures.ts

**检查点**: Foundation 完成后，可并行开始用户故事实现

---

## 阶段 3：用户故事 1 - 行情查询可靠返回（优先级: P1）🎯 MVP

**目标**: 报价与 K 线请求在有效输入下稳定返回成功响应，并在 URL 缺失时给出可理解错误。

**独立测试**: 使用有效股票代码调用两条接口，验证成功响应结构；模拟缺失 URL 情况，验证返回一致错误。

### 用户故事 1 的测试（必需）⚠️

- [x] T003 [P] [US1] 更新报价路由测试的请求构造与成功响应断言，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts
- [x] T004 [P] [US1] 更新 K 线路由测试的请求构造与成功响应断言，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts

### 用户故事 1 的实现

- [x] T005 [US1] 修复报价路由 URL 解析与缺失 URL 错误处理，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/route.ts
- [ ] T006 [US1] 修复 K 线路由 URL 解析与缺失 URL 错误处理，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/route.ts

**检查点**: 此时用户故事 1 应可独立运行并可测试

---

## 阶段 4：用户故事 2 - 错误信息可区分（优先级: P2）

**目标**: 参数错误、权限问题与上游失败在报价与 K 线 API 中具备一致可区分的响应与日志追踪。

**独立测试**: 构造参数错误、权限错误与上游失败的请求，验证返回的错误类型与状态码一致。

### 用户故事 2 的测试（必需）⚠️

- [x] T007 [P] [US2] 更新报价路由错误映射测试用例，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts
- [x] T008 [P] [US2] 更新 K 线路由错误映射测试用例，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts

### 用户故事 2 的实现

- [x] T009 [US2] 为报价路由补齐 Sentry span 与可预期异常捕获，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/route.ts

**检查点**: 此时用户故事 1 与 2 均应可独立运行

---

## 阶段 5：用户故事 3 - 默认行为可预测（优先级: P3）

**目标**: 未指定数据来源时使用明确默认值，并在测试中验证服务调用参数。

**独立测试**: 在不提供 provider 的情况下请求报价与 K 线，验证默认值与服务调用一致。

### 用户故事 3 的测试（必需）⚠️

- [x] T010 [P] [US3] 更新报价路由默认 provider 断言，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts
- [x] T011 [P] [US3] 更新 K 线路由默认 provider 断言，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts

### 用户故事 3 的实现

- [x] T012 [US3] 校验默认 provider 行为在报价与 K 线路由中一致，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/route.ts
- [x] T013 [US3] 校验默认 provider 行为在报价与 K 线路由中一致，路径 /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/route.ts

**检查点**: 所有用户故事应可独立运行

---

## 阶段 6：打磨与跨领域关注点

**目的**: 影响多个用户故事的改进

- [x] T014 [P] 更新验证与运行说明，路径 /Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/quickstart.md
- [x] T015 [P] 复核 API 契约与实现一致性，路径 /Users/tongchen/Projects/Stock-Tracker-1/specs/006-fix-api-invest/contracts/stocks-api.yaml

---

## 依赖与执行顺序

### 阶段依赖

- **初始化（阶段 1）**: 无依赖，可立即开始
- **基础设施（阶段 2）**: 依赖初始化完成 - 阻塞所有用户故事
- **用户故事（阶段 3+）**: 依赖基础设施完成
  - 按优先级顺序（US1 → US2 → US3）以降低文件冲突
- **打磨（最终阶段）**: 依赖所有目标用户故事完成

### 用户故事依赖

- **用户故事 1（P1）**: Foundation 完成后可开始 - 不依赖其他故事
- **用户故事 2（P2）**: 建议在 US1 完成后开始，以避免同文件冲突
- **用户故事 3（P3）**: 建议在 US1 完成后开始，以避免同文件冲突

### 每个用户故事内

- 测试必须先写并失败，再实现
- 先修复路由行为，再完成断言完善
- 完成当前故事后再进入下一个优先级

### 并行机会

- T001 可与 T002 并行
- 同一故事内标记 [P] 的测试可并行
- 不同用户故事不建议并行（共享路由与测试文件）

---

## 并行示例：用户故事 1

```bash
任务: "更新报价路由测试的请求构造与成功响应断言 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts"
任务: "更新 K 线路由测试的请求构造与成功响应断言 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts"
```

---

## 并行示例：用户故事 2

```bash
任务: "更新报价路由错误映射测试用例 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts"
任务: "更新 K 线路由错误映射测试用例 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts"
```

---

## 并行示例：用户故事 3

```bash
任务: "更新报价路由默认 provider 断言 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts"
任务: "更新 K 线路由默认 provider 断言 in /Users/tongchen/Projects/Stock-Tracker-1/src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：初始化
2. 完成阶段 2：基础设施（关键，阻塞后续）
3. 完成阶段 3：用户故事 1
4. **停止并验证**：独立测试用户故事 1
5. 视情况继续 US2/US3
