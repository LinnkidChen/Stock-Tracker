-- Optional but recommended extensions
create extension if not exists pgcrypto; -- for gen_random_uuid()
create extension if not exists citext;   -- case-insensitive text (nice for stock symbols)

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Watchlist items: one row per (user, symbol)
create table if not exists public.stock_watchlist_items (
  id uuid primary key default gen_random_uuid(),

  -- Clerk user id, e.g. "user_2abc123..."
  clerk_user_id text not null,

  -- Use CITEXT so AAPL and aapl are treated the same
  symbol citext not null,

  -- Optional metadata
  exchange citext,
  note text,
  sort_order integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent duplicate symbols per user
  constraint stock_watchlist_items_user_symbol_unique
    unique (clerk_user_id, symbol)
);

-- Keep updated_at current
drop trigger if exists trg_stock_watchlist_items_set_updated_at on public.stock_watchlist_items;
create trigger trg_stock_watchlist_items_set_updated_at
before update on public.stock_watchlist_items
for each row execute function public.set_updated_at();

-- Indexes for fast lookups
create index if not exists idx_stock_watchlist_items_clerk_user_id
  on public.stock_watchlist_items (clerk_user_id);

create index if not exists idx_stock_watchlist_items_symbol
  on public.stock_watchlist_items (symbol);

-- -------------------------
-- Row Level Security (RLS)
-- -------------------------
alter table public.stock_watchlist_items enable row level security;

-- NOTE:
-- These policies assume your Supabase requests include a JWT where:
--   auth.jwt() ->> 'sub'  ==  Clerk user id (e.g., "user_...")
-- This is the common setup when you configure Supabase to accept Clerk JWTs.

drop policy if exists "watchlist_select_own" on public.stock_watchlist_items;
create policy "watchlist_select_own"
on public.stock_watchlist_items
for select
using (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "watchlist_insert_own" on public.stock_watchlist_items;
create policy "watchlist_insert_own"
on public.stock_watchlist_items
for insert
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "watchlist_update_own" on public.stock_watchlist_items;
create policy "watchlist_update_own"
on public.stock_watchlist_items
for update
using (clerk_user_id = (auth.jwt() ->> 'sub'))
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "watchlist_delete_own" on public.stock_watchlist_items;
create policy "watchlist_delete_own"
on public.stock_watchlist_items
for delete
using (clerk_user_id = (auth.jwt() ->> 'sub'));
