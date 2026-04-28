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
