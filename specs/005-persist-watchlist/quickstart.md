# Quickstart: 自选列表持久化

## 前置条件

- 已配置 Clerk 登录（dashboard 页面需要登录）。
- 已准备 Supabase 项目与 watchlist 表结构。

## 配置步骤

1. 复制环境变量模板并填入值：
   - 从 `/Users/tongchen/Projects/Stock-Tracker-2/env.example.txt` 复制到 `.env`
   - 填写以下变量：
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`
2. 确认数据库结构已应用：
   - 参考 `/Users/tongchen/Projects/Stock-Tracker-2/database_schema/watchlist.sql`
3. 启动开发环境：
   - `pnpm dev`

## 验证流程

1. 登录后进入 `/dashboard/stocks`。
2. 添加 1-2 个股票代码。
3. 刷新页面或重新打开应用，确认列表保持一致。
4. 删除某个股票并刷新，确认移除结果持久化。
5. 断开存储连接或使用无效配置时，确认出现明确错误提示。

## 测试

- 运行单元测试：`pnpm test`
