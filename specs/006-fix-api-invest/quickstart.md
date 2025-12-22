# 快速开始

## 目标

验证报价与 K 线 API 的默认数据来源、错误映射与单元测试一致性。

## 前置条件

- 已安装依赖并可运行测试。

## 本地验证步骤

1. 运行相关测试：

```bash
pnpm test -- src/app/api/stocks/quote/[symbol]/__tests__/route.test.ts
pnpm test -- src/app/api/stocks/kline/[symbol]/__tests__/route.test.ts
```

2. 启动开发服务并验证接口行为：

```bash
pnpm dev
```

示例请求：

```bash
curl "http://localhost:3000/api/stocks/quote/AAPL"
curl "http://localhost:3000/api/stocks/quote/AAPL?provider=default"
curl "http://localhost:3000/api/stocks/kline/AAPL"
```

## 预期结果

- 成功请求返回 `success: true` 且结构稳定。
- 参数错误返回可区分错误类型，不应被误报为未知错误。
- 未指定 provider 时采用默认来源。
