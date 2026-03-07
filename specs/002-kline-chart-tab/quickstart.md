# 快速开始: 股票 K 线图 Tab

## 前置条件

- 已安装 Node.js 与 pnpm
- 已配置 Longbridge 凭据：`LONGPORT_APP_KEY`、`LONGPORT_APP_SECRET`、`LONGPORT_ACCESS_TOKEN`

## 本地运行

1. 复制环境模板: `cp /Users/tongchen/Projects/Stock-Tracker-1/env.example.txt /Users/tongchen/Projects/Stock-Tracker-1/.env`
2. 在 `/Users/tongchen/Projects/Stock-Tracker-1/.env` 中填写 `LONGPORT_APP_KEY`、`LONGPORT_APP_SECRET`、`LONGPORT_ACCESS_TOKEN`
3. 启动开发服务: `pnpm dev`
4. 打开 `http://localhost:3000`

## 验证流程

1. 输入有效 ticker（例如 AAPL）
2. 在图表区域切换到 “K 线图” Tab，确认显示 1 年日 K 线与时间范围标识
3. 观察加载状态 → 图表展示 → 切换 ticker 后更新
4. 输入无效 ticker 或包含多个 ticker（例如 `AAPL,MSFT`），确认提示仅支持单一 ticker
5. 输入数据为空的 ticker 或断网，确认有无数据/错误提示与重试操作

## 常见问题

- **401/凭据错误**: 检查 Longbridge 凭据是否已正确写入 `.env`
- **无数据**: 使用支持的 ticker 或稍后重试
