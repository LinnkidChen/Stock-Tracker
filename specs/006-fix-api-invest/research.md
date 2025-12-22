# 调研结论

## 决策 1：请求 URL 解析与默认数据来源

- **Decision**: 使用请求 URL 解析 provider，并在缺失或不合法时返回一致错误；当 provider 未提供时采用默认值。
- **Rationale**: 避免 request.url 缺失导致异常，确保 FR-002 与 FR-005 一致达成。
- **Alternatives considered**: 仅修复测试（仍可能掩盖 URL 缺失问题）；忽略缺失 URL（继续产生 500）。

## 决策 2：单元测试与实现对齐

- **Decision**: 更新报价与 K 线测试构造有效 request.url，并将服务调用断言补齐 provider 参数。
- **Rationale**: 与实际运行环境一致，避免行为漂移导致的误报失败。
- **Alternatives considered**: 改写路由仅使用 nextUrl，或放宽断言检查参数。

## 决策 3：报价路由补齐可观测性

- **Decision**: 在报价路由补充 Sentry span 与异常捕获，保留结构化 logger。
- **Rationale**: 满足宪章的日志与链路追踪要求，确保关键 API 行为可观测。
- **Alternatives considered**: 仅保留 logger（不满足宪章）。
