-- Shared fixed-window API rate limiting.
-- Apply this schema in Supabase before enabling production rate limits.

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint api_rate_limit_buckets_request_count_nonnegative
    check (request_count >= 0)
);

create index if not exists idx_api_rate_limit_buckets_updated_at
  on public.api_rate_limit_buckets (updated_at);

alter table public.api_rate_limit_buckets enable row level security;

create or replace function public.check_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  window_duration interval := make_interval(secs => p_window_seconds);
  bucket public.api_rate_limit_buckets%rowtype;
  bucket_reset timestamptz;
  next_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) = 0 or length(p_bucket_key) > 256 then
    raise exception 'Invalid rate limit bucket key';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'Invalid rate limit';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit window';
  end if;

  if random() < 0.01 then
    delete from public.api_rate_limit_buckets
    where updated_at < now_ts - interval '2 days';
  end if;

  loop
    select *
    into bucket
    from public.api_rate_limit_buckets
    where bucket_key = p_bucket_key
    for update;

    if not found then
      begin
        insert into public.api_rate_limit_buckets (
          bucket_key,
          window_start,
          request_count,
          updated_at
        )
        values (p_bucket_key, now_ts, 1, now_ts);

        allowed := true;
        remaining := greatest(p_limit - 1, 0);
        reset_at := now_ts + window_duration;
        retry_after_seconds := null;
        return next;
        return;
      exception when unique_violation then
        -- Another request created the bucket. Re-read it under row lock.
      end;
    else
      bucket_reset := bucket.window_start + window_duration;

      if bucket_reset <= now_ts then
        update public.api_rate_limit_buckets
        set window_start = now_ts,
            request_count = 1,
            updated_at = now_ts
        where bucket_key = p_bucket_key;

        allowed := true;
        remaining := greatest(p_limit - 1, 0);
        reset_at := now_ts + window_duration;
        retry_after_seconds := null;
        return next;
        return;
      end if;

      if bucket.request_count >= p_limit then
        allowed := false;
        remaining := 0;
        reset_at := bucket_reset;
        retry_after_seconds := greatest(
          1,
          ceil(extract(epoch from (bucket_reset - now_ts)))::integer
        );
        return next;
        return;
      end if;

      next_count := bucket.request_count + 1;

      update public.api_rate_limit_buckets
      set request_count = next_count,
          updated_at = now_ts
      where bucket_key = p_bucket_key;

      allowed := true;
      remaining := greatest(p_limit - next_count, 0);
      reset_at := bucket_reset;
      retry_after_seconds := null;
      return next;
      return;
    end if;
  end loop;
end;
$$;

revoke all on function public.check_api_rate_limit(text, integer, integer) from public;
grant execute on function public.check_api_rate_limit(text, integer, integer) to service_role;
