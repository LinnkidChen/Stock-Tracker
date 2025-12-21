# 仓库指南

## 项目结构与模块组织

- 源码：`src/`，使用 Next.js App Router（`src/app/...`）。
- UI 组件：`src/components/`（设计系统位于 `src/components/ui`）。
- 功能模块：`src/features/*`（例如 `overview`、`kanban`、`products`）。
- 工具与类型：`src/lib/*`、`src/types/*`。
- 配置：`next.config.ts`、`tsconfig.json`、`.eslintrc.json`、`.prettierrc`。
- 公共资源：`public/`。
- 环境模板：`env.example.txt`（拷贝为 `.env`）。

## 构建、测试与开发命令

- 开发服务器：`pnpm dev`（Next.js + Turbopack）。
- 生产构建：`pnpm build`。
- 启动生产服务器：`pnpm start`。
- Lint：`pnpm lint` | 修复 + 格式化：`pnpm lint:fix`。
- 仅格式化：`pnpm format` | 校验：`pnpm format:check`。
- Git 钩子：pre-commit 通过 `lint-staged` 运行 Prettier；pre-push 运行 `pnpm build`。

## 编码风格与命名规范

- 语言：TypeScript/TSX；2 空格缩进；分号；单引号；LF 行尾（Prettier 强制）。
- Lint：Next + TypeScript 规则；`no-console` 与未使用变量警告。
- 文件/目录命名：kebab-case（例如 `user-avatar-profile.tsx`）。
- 组件：React 组件用 PascalCase；hooks 以 `use...` 开头。
- 类型/接口：PascalCase，位于 `src/types` 或就地定义。
- Tailwind：优先使用工具类；`prettier-plugin-tailwindcss` 统一排序。

## 测试指南

- 当前仓库无正式测试配置。如需添加测试：
  - 使用 Vitest + React Testing Library。
  - 测试命名为 `*.test.ts` / `*.test.tsx`，放在源码附近或 `__tests__/`。
  - 在 `package.json` 添加 `test` 脚本，并用 `pnpm test` 运行。

## 提交与 PR 指南

- 提交保持小而聚焦；优先使用 Conventional Commits（例如 `feat: add stocks API route`）。
- 提交正文包含上下文（做了什么/为什么），而不仅是代码变更。
- PR 需提供清晰描述；UI 变更需截图；引用相关 Issue（例如 `Closes #123`）。
- 本地需确保 `pnpm lint` 与 `pnpm build` 通过；避免提交 `.env`。

## 安全与配置提示

- 认证：Clerk 支持无密钥模式；启动时可不设置。准备就绪后设置 `NEXT_PUBLIC_CLERK_*` 与 `CLERK_SECRET_KEY`。
- 错误追踪：支持 Sentry；配置 `NEXT_PUBLIC_SENTRY_*` 与 `SENTRY_AUTH_TOKEN` 以生成 source maps。
- 切勿提交密钥。将 `env.example.txt` 复制为 `.env` 并在本地填写。

# 异常捕获

使用 `Sentry.captureException(error)` 捕获异常并记录到 Sentry。
在 try/catch 或可预期异常的场景使用。

# 追踪示例

在按钮点击、API 调用、函数调用等关键动作中创建 span。
使用 `Sentry.startSpan` 创建 span。
父 span 中可创建子 span。

## 组件动作中的自定义 span

`name` 与 `op` 应对该行为具有明确含义。
基于请求的相关信息与指标添加属性。

```javascript
function TestComponent() {
  const handleTestButtonClick = () => {
    // Create a transaction/span to measure performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "some config";
        const metric = "some metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        doSomething();
      },
    );
  };

  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
```

## API 调用中的自定义 span

`name` 与 `op` 应对该行为具有明确含义。
基于请求的相关信息与指标添加属性。

```javascript
async function fetchUserData(userId) {
  return Sentry.startSpan(
    {
      op: "http.client",
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    },
  );
}
```

# 日志

需要日志时，确保使用 `import * as Sentry from "@sentry/nextjs"` 导入。
通过 `Sentry.init({  enableLogs: true })` 启用日志。
通过 `const { logger } = Sentry` 获取 logger。
Sentry 提供 `consoleLoggingIntegration`，可自动捕获指定 console 错误类型日志。

## 配置

在 NextJS 中，客户端初始化位于 `instrumentation-client.(js|ts)`，
服务端初始化位于 `sentry.server.config.ts`，Edge 初始化位于
`sentry.edge.config.ts`。
无需在其他文件重复初始化；使用 `import * as Sentry from "@sentry/nextjs"`
调用 Sentry 功能。

### 基线

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: <dsn value>,

  enableLogs: true,
});
```

### Logger 集成

```javascript
Sentry.init({
  dsn: <dsn value>,
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
});
```

## Logger 示例

`logger.fmt` 是模板字符串函数，用于将变量注入结构化日志。

```javascript
logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```

## Active Technologies
- TypeScript 5.7, React 19, Next.js 16 (App Router) + Next.js App Router, React, Zustand, Radix UI Dialog, Sentry (001-ticker-error-modal)
- In-memory watchlist (`/Users/tongchen/Projects/Stock-Tracker/src/app/api/watchlist/route.ts`), no external persistence (001-ticker-error-modal)

## Recent Changes
- 001-ticker-error-modal: Added TypeScript 5.7, React 19, Next.js 16 (App Router) + Next.js App Router, React, Zustand, Radix UI Dialog, Sentry
