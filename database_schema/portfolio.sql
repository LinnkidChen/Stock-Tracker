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

-- Current portfolio positions: one row per (user, symbol)
create table if not exists public.stock_portfolio_holdings (
  id uuid primary key default gen_random_uuid(),

  -- Clerk user id, e.g. "user_2abc123..."
  clerk_user_id text not null,

  -- Use CITEXT so AAPL and aapl are treated the same
  symbol citext not null,

  -- Current-position model for v1. Tax lots and transaction ledgers are out of scope.
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

-- Ledger-backed portfolio transactions. Current holdings are derived by
-- replaying these rows in transaction_date, created_at, id order.
create table if not exists public.stock_portfolio_transactions (
  id uuid primary key default gen_random_uuid(),

  -- Clerk user id, e.g. "user_2abc123..."
  clerk_user_id text not null,

  type text not null,
  symbol citext,
  quantity numeric(20, 6),
  price numeric(20, 6),
  amount numeric(20, 6),
  fee_amount numeric(20, 6) not null default 0,
  currency text not null default 'USD',
  transaction_date timestamptz not null default now(),
  note text,

  -- Filled only by the one-time current-position migration below.
  legacy_holding_id uuid unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_portfolio_transactions_type_valid
    check (type in (
      'opening_balance',
      'buy',
      'sell',
      'dividend',
      'deposit',
      'withdrawal',
      'fee'
    )),
  constraint stock_portfolio_transactions_usd_v1
    check (currency = 'USD'),
  constraint stock_portfolio_transactions_quantity_positive
    check (quantity is null or quantity > 0),
  constraint stock_portfolio_transactions_price_nonnegative
    check (price is null or price >= 0),
  constraint stock_portfolio_transactions_amount_positive
    check (amount is null or amount > 0),
  constraint stock_portfolio_transactions_fee_nonnegative
    check (fee_amount >= 0),
  constraint stock_portfolio_transactions_note_length
    check (note is null or char_length(note) <= 500)
);

drop trigger if exists trg_stock_portfolio_transactions_set_updated_at on public.stock_portfolio_transactions;
create trigger trg_stock_portfolio_transactions_set_updated_at
before update on public.stock_portfolio_transactions
for each row execute function public.set_updated_at();

create index if not exists idx_stock_portfolio_transactions_clerk_user_id
  on public.stock_portfolio_transactions (clerk_user_id);

create index if not exists idx_stock_portfolio_transactions_symbol
  on public.stock_portfolio_transactions (symbol);

create index if not exists idx_stock_portfolio_transactions_order
  on public.stock_portfolio_transactions (clerk_user_id, transaction_date, created_at, id);

-- Idempotently seed the ledger from the legacy current-position table.
insert into public.stock_portfolio_transactions (
  clerk_user_id,
  type,
  symbol,
  quantity,
  price,
  amount,
  fee_amount,
  currency,
  transaction_date,
  note,
  legacy_holding_id,
  created_at,
  updated_at
)
select
  h.clerk_user_id,
  'opening_balance',
  h.symbol,
  h.quantity,
  h.avg_cost,
  h.quantity * h.avg_cost,
  0,
  'USD',
  h.created_at,
  'Migrated from legacy current-position holding',
  h.id,
  h.created_at,
  h.updated_at
from public.stock_portfolio_holdings h
where not exists (
  select 1
  from public.stock_portfolio_transactions t
  where t.legacy_holding_id = h.id
);

-- -------------------------
-- Row Level Security (RLS)
-- -------------------------
alter table public.stock_portfolio_holdings enable row level security;

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

alter table public.stock_portfolio_transactions enable row level security;

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
