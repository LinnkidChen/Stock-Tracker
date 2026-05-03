-- Optional but recommended extensions
create extension if not exists pgcrypto; -- for gen_random_uuid()
create extension if not exists citext;   -- case-insensitive stock symbols

-- updated_at trigger helper shared with watchlist schema
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Current portfolio positions: one row per (user, symbol).
-- Preserved as a migration/read-model table while positions are derived from
-- stock_portfolio_transactions in application code.
create table if not exists public.stock_portfolio_holdings (
  id uuid primary key default gen_random_uuid(),

  -- Clerk user id, e.g. "user_2abc123..."
  clerk_user_id text not null,

  -- Use CITEXT so AAPL and aapl are treated the same
  symbol citext not null,

  -- Snapshot of the current position. The transaction ledger is the source of
  -- truth for newly written portfolio activity.
  quantity numeric(20, 6) not null,
  avg_cost numeric(20, 6) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_portfolio_holdings_quantity_positive
    check (quantity > 0),
  constraint stock_portfolio_holdings_avg_cost_nonnegative
    check (avg_cost >= 0),
  constraint stock_portfolio_holdings_user_symbol_unique
    unique (clerk_user_id, symbol)
);

-- Keep updated_at current
drop trigger if exists trg_stock_portfolio_holdings_set_updated_at on public.stock_portfolio_holdings;
create trigger trg_stock_portfolio_holdings_set_updated_at
before update on public.stock_portfolio_holdings
for each row execute function public.set_updated_at();

-- Indexes for fast lookups
create index if not exists idx_stock_portfolio_holdings_clerk_user_id
  on public.stock_portfolio_holdings (clerk_user_id);

create index if not exists idx_stock_portfolio_holdings_symbol
  on public.stock_portfolio_holdings (symbol);

-- Portfolio transaction ledger. This records how a position was built, reduced,
-- adjusted, or paid cash events while preserving the current holdings snapshot.
create table if not exists public.stock_portfolio_transactions (
  id uuid primary key default gen_random_uuid(),

  clerk_user_id text not null,
  symbol citext not null,
  type text not null,

  -- Shares/units for buy, sell, and transfer. Transfer quantities may be
  -- negative when moving shares out.
  quantity numeric(20, 6),

  -- Per-share price for buy/sell and transfer-in average cost.
  price numeric(20, 6),

  -- Cash amount for dividend and standalone fee events.
  amount numeric(20, 6),

  -- Trade fee attached to buy/sell/transfer events.
  fee numeric(20, 6) not null default 0,

  split_ratio_from numeric(20, 6),
  split_ratio_to numeric(20, 6),

  occurred_at timestamptz not null default now(),
  note text,

  -- Used only for the one-time migration from current holdings into the ledger.
  source_holding_id uuid references public.stock_portfolio_holdings(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_portfolio_transactions_type_valid
    check (type in ('buy', 'sell', 'dividend', 'split', 'fee', 'transfer')),
  constraint stock_portfolio_transactions_fee_nonnegative
    check (fee >= 0),
  constraint stock_portfolio_transactions_event_shape
    check (
      (
        type in ('buy', 'sell')
        and quantity is not null
        and quantity > 0
        and price is not null
        and price >= 0
      )
      or (
        type = 'transfer'
        and quantity is not null
        and quantity <> 0
        and price is not null
        and price >= 0
      )
      or (
        type in ('dividend', 'fee')
        and amount is not null
        and amount > 0
      )
      or (
        type = 'split'
        and split_ratio_from is not null
        and split_ratio_from > 0
        and split_ratio_to is not null
        and split_ratio_to > 0
      )
    )
);

-- Keep updated_at current
drop trigger if exists trg_stock_portfolio_transactions_set_updated_at on public.stock_portfolio_transactions;
create trigger trg_stock_portfolio_transactions_set_updated_at
before update on public.stock_portfolio_transactions
for each row execute function public.set_updated_at();

create index if not exists idx_stock_portfolio_transactions_clerk_user_id
  on public.stock_portfolio_transactions (clerk_user_id);

create index if not exists idx_stock_portfolio_transactions_symbol
  on public.stock_portfolio_transactions (symbol);

create index if not exists idx_stock_portfolio_transactions_occurred_at
  on public.stock_portfolio_transactions (occurred_at);

create unique index if not exists idx_stock_portfolio_transactions_source_holding_id
  on public.stock_portfolio_transactions (source_holding_id)
  where source_holding_id is not null;

-- One-time seed so existing current holdings have a corresponding ledger entry.
insert into public.stock_portfolio_transactions (
  clerk_user_id,
  symbol,
  type,
  quantity,
  price,
  occurred_at,
  note,
  source_holding_id
)
select
  holding.clerk_user_id,
  holding.symbol,
  'transfer',
  holding.quantity,
  holding.avg_cost,
  holding.created_at,
  'Migrated current holding',
  holding.id
from public.stock_portfolio_holdings holding
where not exists (
  select 1
  from public.stock_portfolio_transactions ledger_transaction
  where ledger_transaction.source_holding_id = holding.id
);

-- -------------------------
-- Row Level Security (RLS)
-- -------------------------
alter table public.stock_portfolio_holdings enable row level security;
alter table public.stock_portfolio_transactions enable row level security;

-- These policies assume Supabase receives a Clerk JWT where:
--   auth.jwt() ->> 'sub' == Clerk user id

drop policy if exists "portfolio_holdings_select_own" on public.stock_portfolio_holdings;
create policy "portfolio_holdings_select_own"
on public.stock_portfolio_holdings
for select
using (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_holdings_insert_own" on public.stock_portfolio_holdings;
create policy "portfolio_holdings_insert_own"
on public.stock_portfolio_holdings
for insert
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_holdings_update_own" on public.stock_portfolio_holdings;
create policy "portfolio_holdings_update_own"
on public.stock_portfolio_holdings
for update
using (clerk_user_id = (auth.jwt() ->> 'sub'))
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_holdings_delete_own" on public.stock_portfolio_holdings;
create policy "portfolio_holdings_delete_own"
on public.stock_portfolio_holdings
for delete
using (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_transactions_select_own" on public.stock_portfolio_transactions;
create policy "portfolio_transactions_select_own"
on public.stock_portfolio_transactions
for select
using (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_transactions_insert_own" on public.stock_portfolio_transactions;
create policy "portfolio_transactions_insert_own"
on public.stock_portfolio_transactions
for insert
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_transactions_update_own" on public.stock_portfolio_transactions;
create policy "portfolio_transactions_update_own"
on public.stock_portfolio_transactions
for update
using (clerk_user_id = (auth.jwt() ->> 'sub'))
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "portfolio_transactions_delete_own" on public.stock_portfolio_transactions;
create policy "portfolio_transactions_delete_own"
on public.stock_portfolio_transactions
for delete
using (clerk_user_id = (auth.jwt() ->> 'sub'));
