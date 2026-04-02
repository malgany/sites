create table if not exists public.catalog_prompts (
  slug text primary key,
  title text not null,
  type_label text not null,
  content_markdown text not null,
  reference_lookup jsonb not null default '{}'::jsonb,
  poster_url text,
  preview_url text,
  preview_kind text not null default 'image' check (preview_kind in ('image', 'video')),
  preview_width integer,
  preview_height integer,
  source_file_name text not null,
  source_hash text not null,
  sort_order integer not null,
  is_public boolean not null default true,
  required_plan text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.catalog_prompts
add column if not exists poster_url text;

alter table public.catalog_prompts
add column if not exists preview_width integer;

alter table public.catalog_prompts
add column if not exists preview_height integer;

alter table public.catalog_prompts
add column if not exists reference_lookup jsonb not null default '{}'::jsonb;

create or replace function public.set_catalog_prompts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_catalog_prompts_updated_at on public.catalog_prompts;

create trigger set_catalog_prompts_updated_at
before update on public.catalog_prompts
for each row
execute function public.set_catalog_prompts_updated_at();

alter table public.catalog_prompts enable row level security;

drop policy if exists "Public can read published catalog prompts" on public.catalog_prompts;

create policy "Public can read published catalog prompts"
on public.catalog_prompts
for select
using (is_public = true);

insert into storage.buckets (id, name, public)
values ('catalog-previews', 'catalog-previews', true)
on conflict (id) do update
set public = excluded.public;
