# 功能规范: 行情数据源兼容层

**功能分支**: `[003-quote-backend-toggle]`  
**创建日期**: 2025-12-21  
**状态**: 已更新  

## 摘要

当前仓库仅支持 Longbridge 作为真实行情数据源，同时保留 provider 抽象以兼容后续扩展。前端持久化值与 UI 展示统一使用 `longbridge`，后端 API 继续接受 `provider=default` 作为兼容别名。

## 当前要求

- 行情页面必须展示当前数据源为 Longbridge。
- `quoteProvider` 持久化值必须规范化为 `longbridge`。
- `/api/stocks/quote/{symbol}` 与 `/api/stocks/kline/{symbol}` 的 `provider` 查询参数仅支持 `longbridge` 与兼容别名 `default`。
- 未知 provider 必须返回 `INVALID_PROVIDER`。
- provider UI 保留外壳，但仅显示 Longbridge 单项，不再提供多数据源切换能力。

## 验收场景

1. **Given** 用户访问任一行情页面, **When** 页面加载, **Then** 界面显示 Longbridge 且随后的请求使用 `provider=longbridge`。
2. **Given** 旧浏览器存储中存在 `quoteProvider=default` 或其他过时值, **When** 应用初始化, **Then** 系统将其迁移为 `longbridge` 并回写本地存储。
3. **Given** 客户端调用 `provider=default`, **When** 请求到达后端, **Then** 后端仍返回 Longbridge 数据。
4. **Given** 客户端调用未知 provider, **When** 请求到达后端, **Then** 后端返回 `400 INVALID_PROVIDER`。
