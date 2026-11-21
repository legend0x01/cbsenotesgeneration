-- =========================================================================
-- NCERT Notes — Supabase schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → Run.
-- One row per (student, chapter). Row Level Security means a signed-in
-- student can only ever see and change their own notes.
-- =========================================================================

create table if not exists public.notes (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  chapter_id  text        not null,
  outline     jsonb,                                  -- [{ title, topics[] }, ...]
  chunks      jsonb       not null default '[]'::jsonb, -- markdown of each generated part
  parts_done  int         not null default 0,
  parts_total int         not null default 0,
  model       text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, chapter_id),
  constraint chapter_id_length check (char_length(chapter_id) <= 120)
);

alter table public.notes enable row level security;

drop policy if exists "Students read their own notes"   on public.notes;
drop policy if exists "Students add their own notes"    on public.notes;
drop policy if exists "Students update their own notes" on public.notes;
drop policy if exists "Students delete their own notes" on public.notes;

create policy "Students read their own notes"   on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students add their own notes"    on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update their own notes" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete their own notes" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing.
revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;
