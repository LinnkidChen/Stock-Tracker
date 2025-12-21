# 调研记录: K线图表独立页与导航

**日期**: 2025-12-21  
**范围**: 图表页拆分、K 线图表呈现、导航入口与数据来源复用

## 决策 1: 图表库选择

- **Decision**: 使用现有的 klinecharts（KLineChart）作为图表呈现方案。
- **Rationale**: 仓库已集成 klinecharts 相关封装，可直接复用，符合用户指示并减少迁移成本。
- **Alternatives considered**: 保留 lightweight-charts（TradingView Light Chart）、引入新的第三方图表库。

## 决策 2: 图表页路由形态

- **Decision**: 新增独立图表页路由（位于仪表盘下的独立页面）。
- **Rationale**: 符合 App Router 结构与“独立页面”的需求，便于扩展与导航。
- **Alternatives considered**: 在仪表盘内使用弹窗或折叠区展示图表。

## 决策 3: 导航入口位置

- **Decision**: 在概览卡片下方增加图表导航卡片作为入口。
- **Rationale**: 与现有仪表盘信息流一致，用户更容易发现图表入口。
- **Alternatives considered**: 顶部主导航、侧边栏或浮动按钮。

## 决策 4: 标的选择与默认值

- **Decision**: 复用现有标的选择状态作为图表页默认值，同时允许在图表页直接切换标的。
- **Rationale**: 保持用户上下文一致，减少重复输入。
- **Alternatives considered**: 图表页完全独立选择状态、强制重新选择。

## 决策 5: 数据来源

- **Decision**: 使用现有 `/api/stocks/kline/{symbol}` 作为 K 线数据来源，并延续现有错误/缓存策略。
- **Rationale**: 现有 API 已覆盖所需数据与错误处理，避免新增后端复杂度。
- **Alternatives considered**: 前端直接调用第三方行情接口、创建新的后端代理端点。

## 决策 6: 替换 lightweight-charts

- **Decision**: 全面移除 lightweight-charts 价格图表实现，统一使用 klinecharts。
- **Rationale**: 用户明确要求统一图表体验，减少维护两套图表的复杂度。
- **Alternatives considered**: 保留两套图表并逐步迁移，或继续使用 lightweight-charts。
