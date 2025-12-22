# 数据模型: 自选列表持久化

## 实体: 自选列表（Watchlist）

- **含义**: 某一用户的自选股票集合（逻辑实体，基于条目聚合）。
- **关键属性**:
  - ownerId: 用户标识（Clerk userId）
  - items: WatchlistItem 列表
- **关系**: 一个 Watchlist 拥有多个 WatchlistItem。

## 实体: 自选列表条目（WatchlistItem）

- **含义**: 自选列表中的单个股票记录。
- **关键属性**:
  - id: 唯一标识
  - ownerId (clerk_user_id): 归属用户标识
  - symbol: 股票标识（大小写不敏感，按规范化格式保存）
  - exchange: 可选交易所
  - note: 可选备注
  - sortOrder: 可选排序权重
  - createdAt: 创建时间
  - updatedAt: 更新时间
- **关系**: 每个 WatchlistItem 只属于一个 Watchlist。

## 校验与约束

- symbol 必须为有效股票代码（1-5 个字母），保存为规范化格式。
- (ownerId, symbol) 必须唯一，防止重复添加。
- ownerId 必填，且访问仅允许所属用户。

## 状态流转

- **新增**: 用户添加 symbol → 创建 WatchlistItem；重复添加为幂等操作。
- **删除**: 用户移除 symbol → 删除对应 WatchlistItem；不存在时保持列表不变。
- **读取**: 按 ownerId 查询全部条目并返回稳定顺序的 symbol 列表。
