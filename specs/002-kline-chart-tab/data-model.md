# 数据模型: 股票 K 线图 Tab

## 实体

### Ticker

- **字段**: `symbol`（string，股票代码）
- **校验**: 必填；仅字母；长度 1-5；统一大写

### KLineCandle

- **字段**:
  - `timestamp`（number，毫秒时间戳，UTC）
  - `open`（number）
  - `high`（number）
  - `low`（number）
  - `close`（number）
  - `volume`（number）
- **校验**:
  - `high >= max(open, close)`
  - `low <= min(open, close)`
  - 价格与成交量为非负数
  - 时间严格递增（允许交易日缺口）

### TimeRange

- **字段**: `startDate`（ISO string），`endDate`（ISO string），`interval`（string，固定为 `1d`）
- **校验**: `endDate` >= `startDate`；范围不超过 1 年

### KLineSeries

- **字段**: `symbol`（string），`range`（TimeRange），`candles`（KLineCandle[]），`lastUpdated`（ISO string）
- **校验**: `candles` 按时间升序；`symbol` 与请求 ticker 一致

## 关系

- 一个 `Ticker` 对应一个 `KLineSeries`（按默认 1 年日线范围）
- 一个 `KLineSeries` 包含多条 `KLineCandle`

## 状态流转

- 客户端加载状态: `idle` → `loading` → `success | no-data | error`
- ticker 切换时重置为 `loading`，完成后进入 `success` 或 `no-data`
