# 调研: 自选列表持久化

## 决策 1：用户身份与数据隔离
- **Decision**: 使用 Clerk 的 userId 作为自选列表归属标识，并要求 /api/watchlist 仅在已登录用户上下文中读写。
- **Rationale**: 现有 dashboard 已强制登录；数据库结构与 RLS 规则以 Clerk userId 为主键字段，可确保用户间隔离与一致性。
- **Alternatives considered**: 继续使用 IP 作为访客标识；仅在客户端本地存储；使用服务端 service role 绕过 RLS。

## 决策 2：Supabase 访问方式
- **Decision**: 使用 Supabase JS 客户端 + Clerk JWT 访问受 RLS 保护的数据（使用公开 URL/key 并在请求中携带用户 JWT）。
- **Rationale**: env 已提供 Supabase 连接信息且表启用 RLS，使用用户 JWT 可满足最小权限访问。
- **Alternatives considered**: 使用 service role key（需要新增密钥且绕过 RLS）；通过自建 API 转发 SQL。

## 决策 3：数据写入模型
- **Decision**: 直接写入 `stock_watchlist_items` 表；添加时插入一行，删除时按用户与 symbol 删除；重复添加视为幂等操作。
- **Rationale**: 表结构已存在且提供唯一约束，符合“每个用户每个 symbol 一条记录”的需求。
- **Alternatives considered**: 单行 JSON/数组存储；额外创建 watchlist 表。

## 决策 4：读取与排序策略
- **Decision**: 初始加载时查询用户的全部 watchlist item，按创建时间或显式排序字段返回；默认按创建时间升序。
- **Rationale**: 保持稳定顺序与预期一致；避免 UI 在刷新后重排。
- **Alternatives considered**: 不保证顺序；按 symbol 排序。

## 决策 5：错误处理与追踪
- **Decision**: API 层对 Supabase 错误做统一响应并记录 Sentry；前端初始加载与写入失败时保留回滚与提示。
- **Rationale**: 满足可见反馈与宪章要求的日志/追踪规范。
- **Alternatives considered**: 静默失败或仅在控制台记录。
