-- =========================================================================
-- NCERT Notes — free built-in AI usage limits
-- Run this once in Supabase: Dashboard → SQL Editor → New query → Run.
-- Safe to run again. Needs schema.sql to have been run first.
--
-- /api/generate (the free NVIDIA AI) calls use_free_ai() before every request.
-- Counting in the database means the limit holds across every Vercel server
-- copy and restart (an in-memory count resets whenever a copy starts).
--
--   * per student: at most 60 requests an hour and 200 a day;
--   * everyone together: at most 3000 requests a day, so a few abusive
--     accounts cannot use up the NVIDIA keys.
--
-- The server may ask for LOWER limits (Vercel env vars FREE_AI_HOURLY_LIMIT,
-- FREE_AI_DAILY_LIMIT, FREE_AI_GLOBAL_DAILY_LIMIT) but never higher ones:
-- to raise a ceiling, change the numbers below and run this file again.
-- A student calling use_free_ai() directly can only use up their own allowance.
-- =========================================================================

create table if not exists public.free_ai_usage (
  id      bigint      generated always as identity primary key,
  user_id uuid        not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists free_ai_usage_user_at on public.free_ai_usage (user_id, at);
create index if not exists free_ai_usage_at on public.free_ai_usage (at);

-- Nobody reads or writes the table directly; only use_free_ai() does.
alter table public.free_ai_usage enable row level security;
revoke all on public.free_ai_usage from anon, authenticated;

create or replace function public.use_free_ai(
  p_hourly int default null, p_daily int default null, p_global_daily int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  hourly   int := least(coalesce(p_hourly, 60), 60);           -- ceilings: edit these to raise them
  daily    int := least(coalesce(p_daily, 200), 200);
  everyone int := least(coalesce(p_global_daily, 3000), 3000);
  n_hour   int;
  n_day    int;
  n_all    int;
begin
  if uid is null then
    raise exception 'Sign in with Google to use the free AI.' using errcode = '28000';
  end if;

  -- One request at a time per student, so parallel requests can't slip past the limit.
  perform pg_advisory_xact_lock(hashtextextended('free_ai:' || uid::text, 0));

  -- Keep the table small: nothing older than two days is ever needed.
  delete from public.free_ai_usage where at < now() - interval '2 days';

  select count(*) filter (where at > now() - interval '1 hour'), count(*)
    into n_hour, n_day
    from public.free_ai_usage where user_id = uid and at > now() - interval '1 day';
  if n_hour >= hourly then
    return jsonb_build_object('ok', false, 'reason', 'hour', 'limit', hourly);
  end if;
  if n_day >= daily then
    return jsonb_build_object('ok', false, 'reason', 'day', 'limit', daily);
  end if;

  select count(*) into n_all from public.free_ai_usage where at > now() - interval '1 day';
  if n_all >= everyone then
    return jsonb_build_object('ok', false, 'reason', 'everyone', 'limit', everyone);
  end if;

  insert into public.free_ai_usage (user_id) values (uid);
  return jsonb_build_object('ok', true, 'hour', n_hour + 1, 'day', n_day + 1, 'hourly', hourly, 'daily', daily);
end $$;

revoke all on function public.use_free_ai(int, int, int) from public, anon;
grant execute on function public.use_free_ai(int, int, int) to authenticated;
