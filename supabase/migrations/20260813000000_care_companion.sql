-- 安心陪診2：匿名使用者只可讀寫自己的看診整理紀錄與文件。

create extension if not exists pgcrypto;

create table if not exists public.care_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  summary text not null default '',
  medication_note text not null default '',
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_documents (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.care_visits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('藥袋', '預約單', '衛教單')),
  storage_path text not null unique,
  original_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists care_visits_user_created_idx on public.care_visits (user_id, created_at desc);
create index if not exists care_documents_visit_idx on public.care_documents (visit_id);

alter table public.care_visits enable row level security;
alter table public.care_documents enable row level security;

drop policy if exists "Users manage own care visits" on public.care_visits;
create policy "Users manage own care visits" on public.care_visits
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own care documents" on public.care_documents;
create policy "Users manage own care documents" on public.care_documents
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('care-documents', 'care-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own care files" on storage.objects;
create policy "Users upload own care files" on storage.objects
for insert to authenticated
with check (bucket_id = 'care-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own care files" on storage.objects;
create policy "Users read own care files" on storage.objects
for select to authenticated
using (bucket_id = 'care-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own care files" on storage.objects;
create policy "Users delete own care files" on storage.objects
for delete to authenticated
using (bucket_id = 'care-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
