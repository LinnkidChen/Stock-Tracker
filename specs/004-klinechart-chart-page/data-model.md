# 数据模型: K线图表独立页与导航

## 实体

### 标的（Ticker）

- **字段**:
  - symbol: 股票代码（必填，需符合现有校验规则）
  - name: 股票名称（可选）
- **校验规则**:
  - 仅允许有效股票代码格式
- **关系**:
  - 一个标的对应一个或多个 K 线序列

### K 线序列（KLineSeries）

- **字段**:
  - symbol: 标的代码
  - range: 时间范围（startDate, endDate, interval）
  - candles: K 线列表（timestamp, open, high, low, close, volume）
  - lastUpdated: 数据更新时间
- **校验规则**:
  - candles 必须按时间顺序
  - 数值字段为非负或合理区间
- **关系**:
  - 关联到一个标的（Ticker）

### 图表页状态（ChartPageState）

- **字段**:
  - selectedSymbol: 当前选择的标的
  - status: idle | loading | ready | empty | error
  - message: 失败或空数据提示文本（可选）
- **状态转换**:
  - idle → loading → ready
  - loading → empty | error
  - ready → loading（切换标的）

## 约束

- 仅展示用户有权限访问的标的
- 错误与空数据状态必须可区分并可追踪
