# 调研与决策

## 决策 1: K 线数据来源

- **Decision**: 通过 Longbridge 的日线蜡烛图接口获取数据，并在服务端标准化为最近 1 年日 K。  
- **Rationale**: 仓库现已统一使用 Longbridge 作为唯一行情数据源，可复用 provider 抽象、鉴权与错误处理逻辑。  
- **Alternatives considered**: 使用本地 mock 数据；引入新数据源（Polygon/Finnhub）；仅展示现有报价数据。

## 决策 2: 图表渲染方式

- **Decision**: 使用 klinecharts 的 KLineChart 组件，客户端动态加载并在组件卸载时销毁实例。  
- **Rationale**: 用户明确要求使用 klinecharts；动态加载可降低首屏包体积，避免 SSR 问题。  
- **Alternatives considered**: 继续使用 lightweight-charts；用 Recharts 等通用图表库。

## 决策 3: 数据获取与缓存策略

- **Decision**: 新增 `GET /api/stocks/kline/{symbol}`，客户端用 React Query `useQuery` 拉取数据并设置较长的 `staleTime`（例如 1 天）。  
- **Rationale**: 与现有 `useStockQuote` 一致，减少重复调用并保持图表数据查询稳定。  
- **Alternatives considered**: 客户端直连第三方 API；服务端渲染或 server actions。

## 决策 4: 监控与错误处理

- **Decision**: 在 UI 进入 K 线图、ticker 切换、加载失败与 API 请求处创建 Sentry span，并在失败时 `captureException`。  
- **Rationale**: 满足宪章对日志与追踪的要求，支持衡量成功标准与错误率。  
- **Alternatives considered**: 使用 `console.*` 或仅客户端 toast 提示。

## 决策 5: 数据结构与排序

- **Decision**: API 返回统一的 `APIResponse<KLineSeries>`；K 线数据按时间升序排列，时间用毫秒时间戳。  
- **Rationale**: 与现有 API 响应包裹格式一致，便于前端渲染与测试。  
- **Alternatives considered**: 直接透传第三方响应；使用字符串日期。
