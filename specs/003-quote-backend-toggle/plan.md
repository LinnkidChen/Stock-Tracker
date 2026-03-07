# 实施计划: 行情数据源兼容层

## 摘要

- 保留 provider 抽象与 `provider` 查询参数，但 Longbridge 是唯一真实实现。
- 前端状态、localStorage 与 UI 统一规范为 `longbridge`。
- 后端兼容 `default` 别名，并对未知 provider 返回 `INVALID_PROVIDER`。

## 关键改动

- provider 工厂仅解析 `longbridge` 与 `default`，其余值返回 `INVALID_PROVIDER`。
- Dashboard store 在 hydration 和显式更新时都将 provider 规范化为 `longbridge`。
- Quote/KLine hooks 与 watchlist 请求统一携带 `provider=longbridge`。
- Provider UI 保留壳层，但仅展示 Longbridge。

## 验证

- API 路由覆盖无 provider、`provider=longbridge`、`provider=default` 和无效 provider。
- store 测试覆盖 localStorage 迁移与持久化规范化。
- 组件与 hooks 测试覆盖单项 provider UI 和请求参数传播。
