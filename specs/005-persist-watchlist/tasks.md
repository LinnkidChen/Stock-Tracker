---

description: "自选列表持久化的任务列表"
---

# 任务: 自选列表持久化

**输入**: 来自 `/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/` 的设计文档
**前置条件**: plan.md（必需）、spec.md（用户故事必需）、research.md、data-model.md、contracts/

**测试**: 功能规范要求新增/修改逻辑必须包含单元测试，任务列表已覆盖。

**组织方式**: 任务按用户故事分组，以便每个故事可独立实现与测试。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（例如 US1、US2、US3）
- 描述中包含精确文件路径（绝对路径）

## 阶段 1：初始化（共享基础）

**目的**: 准备持久化依赖与项目基础配置

- [ ] T001 添加 Supabase 客户端依赖到 `/Users/tongchen/Projects/Stock-Tracker-2/package.json` 并更新 `/Users/tongchen/Projects/Stock-Tracker-2/pnpm-lock.yaml`

---

## 阶段 2：基础设施（阻塞性前置）

**目的**: 用户故事实现前必须完成的存储与访问基础设施

- [ ] T002 新增 Supabase 环境配置读取与校验在 `/Users/tongchen/Projects/Stock-Tracker-2/src/lib/supabase/env.ts`
- [ ] T003 新增 Supabase server 客户端工厂（支持 Clerk JWT）在 `/Users/tongchen/Projects/Stock-Tracker-2/src/lib/supabase/server.ts`
- [ ] T004 新增 watchlist 持久化访问模块（get/add/remove）在 `/Users/tongchen/Projects/Stock-Tracker-2/src/lib/watchlist/storage.ts`
- [ ] T005 [P] 定义 watchlist 类型与接口在 `/Users/tongchen/Projects/Stock-Tracker-2/src/types/watchlist.ts`

**检查点**: 基础设施完成后，用户故事可并行进行

---

## 阶段 3：用户故事 1 - 自选列表可持续存在（优先级: P1）🎯 MVP

**目标**: 用户的自选列表在刷新或重新打开应用后可恢复

**独立测试**: 通过登录后添加股票并刷新页面，验证列表保持一致且为用户隔离

### 用户故事 1 的测试

- [ ] T006 [P] [US1] 新增 GET /api/watchlist 与 add 行为的路由测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts`
- [ ] T007 [P] [US1] 扩展持久化加载的集成测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/WatchlistCard.integration.test.tsx`
- [ ] T008 [P] [US1] 扩展初始加载与重复添加的单元测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx`

### 用户故事 1 的实现

- [ ] T009 [US1] 实现 GET /api/watchlist 与 add 持久化逻辑在 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.ts`
- [ ] T010 [US1] 在初始渲染加载 watchlist 并记录 span/log 于 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/WatchlistCard.tsx`

**检查点**: 用户故事 1 可独立运行并通过测试

---

## 阶段 4：用户故事 2 - 删除操作也会被持久化（优先级: P2）

**目标**: 删除的股票在刷新后仍保持移除状态

**独立测试**: 删除已有股票后刷新页面，验证不再出现

### 用户故事 2 的测试

- [ ] T011 [P] [US2] 增加 remove 持久化的路由测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts`
- [ ] T012 [P] [US2] 扩展移除持久化的集成测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/WatchlistCard.integration.test.tsx`

### 用户故事 2 的实现

- [ ] T013 [US2] 实现 remove 持久化逻辑在 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.ts`

**检查点**: 用户故事 2 可独立运行并通过测试

---

## 阶段 5：用户故事 3 - 保存失败时用户可感知（优先级: P3）

**目标**: 保存或加载失败时给出明确反馈并保持正确状态

**独立测试**: 模拟后端失败，验证 UI 显示错误提示且不误报保存成功

### 用户故事 3 的测试

- [ ] T014 [P] [US3] 添加鉴权缺失与存储失败的路由测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts`
- [ ] T015 [P] [US3] 添加加载失败与保存失败提示的 UI 测试在 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx`

### 用户故事 3 的实现

- [ ] T016 [US3] 在 API 层加入错误映射与 Sentry 捕获日志于 `/Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.ts`
- [ ] T017 [US3] 在 UI 层加入加载失败提示与重试入口于 `/Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/WatchlistCard.tsx`

**检查点**: 用户故事 3 可独立运行并通过测试

---

## 阶段 6：打磨与跨领域关注点

**目的**: 完成文档更新与交付验证

- [ ] T018 [P] 更新持久化说明与环境变量文档于 `/Users/tongchen/Projects/Stock-Tracker-2/README.md`
- [ ] T019 更新验证步骤与故障排查于 `/Users/tongchen/Projects/Stock-Tracker-2/specs/005-persist-watchlist/quickstart.md`

---

## 依赖与执行顺序

### 阶段依赖

- **初始化（阶段 1）**: 无依赖，可立即开始
- **基础设施（阶段 2）**: 依赖阶段 1 完成 - 阻塞所有用户故事
- **用户故事（阶段 3-5）**: 依赖阶段 2 完成
- **打磨（阶段 6）**: 依赖目标用户故事完成

### 用户故事依赖图

- **US1 (P1)** → **US2 (P2)** → **US3 (P3)**
- US2/US3 可在 US1 完成后并行推进（若团队允许）

### 每个用户故事内

- 先测试，再实现
- 先服务端逻辑，再前端集成

### 并行机会

- T005 可与 T002/T003 并行（不同文件）
- 各用户故事内标记 [P] 的测试任务可并行执行

---

## 并行示例：用户故事 1

```bash
任务: "Add GET/add API tests in /Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts"
任务: "Add initial load integration test in /Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/WatchlistCard.integration.test.tsx"
任务: "Add initial load unit test in /Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx"
```

---

## 并行示例：用户故事 2

```bash
任务: "Add remove API tests in /Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts"
任务: "Add remove persistence integration test in /Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/WatchlistCard.integration.test.tsx"
```

---

## 并行示例：用户故事 3

```bash
任务: "Add API error handling tests in /Users/tongchen/Projects/Stock-Tracker-2/src/app/api/watchlist/route.test.ts"
任务: "Add UI error feedback tests in /Users/tongchen/Projects/Stock-Tracker-2/src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：初始化
2. 完成阶段 2：基础设施（阻塞后续）
3. 完成阶段 3：用户故事 1
4. 验证：刷新后列表保持一致且用户隔离有效
5. 再进入 US2、US3
