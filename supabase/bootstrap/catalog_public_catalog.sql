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
  is_active boolean not null default true,
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

alter table public.catalog_prompts
add column if not exists is_active boolean not null default true;

create or replace function public.set_row_updated_at()
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
execute function public.set_row_updated_at();

create or replace view public.catalog_public_catalog as
select
  slug,
  title,
  type_label,
  reference_lookup,
  poster_url,
  preview_url,
  preview_kind,
  preview_width,
  preview_height,
  is_public,
  required_plan,
  sort_order
from public.catalog_prompts
where is_active = true
  and is_public = true;

revoke all on public.catalog_prompts from anon, authenticated;
grant select on public.catalog_public_catalog to anon, authenticated;

alter table public.catalog_prompts enable row level security;

drop policy if exists "Public can read published catalog prompts" on public.catalog_prompts;

create table if not exists public.user_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_code text not null default 'premium',
  purchase_option text,
  status text not null default 'pending',
  billing_status text,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_subscription_schedule_id text,
  source_slug text,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_access
add column if not exists plan_code text not null default 'premium';

alter table public.user_access
add column if not exists purchase_option text;

alter table public.user_access
add column if not exists status text not null default 'pending';

alter table public.user_access
add column if not exists billing_status text;

alter table public.user_access
add column if not exists stripe_customer_id text;

alter table public.user_access
add column if not exists stripe_checkout_session_id text;

alter table public.user_access
add column if not exists stripe_payment_intent_id text;

alter table public.user_access
add column if not exists stripe_subscription_id text;

alter table public.user_access
add column if not exists stripe_subscription_schedule_id text;

alter table public.user_access
add column if not exists source_slug text;

alter table public.user_access
add column if not exists granted_at timestamptz;

alter table public.user_access
add column if not exists revoked_at timestamptz;

alter table public.user_access
add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.user_access
add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_access_plan_code_check'
  ) then
    alter table public.user_access
    add constraint user_access_plan_code_check
    check (plan_code in ('premium'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_access_status_check'
  ) then
    alter table public.user_access
    add constraint user_access_status_check
    check (status in ('pending', 'active', 'revoked'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_access_purchase_option_check'
  ) then
    alter table public.user_access
    add constraint user_access_purchase_option_check
    check (purchase_option in ('one_time', 'installments_10'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_access_billing_status_check'
  ) then
    alter table public.user_access
    add constraint user_access_billing_status_check
    check (billing_status in ('pending', 'active', 'delinquent', 'completed', 'canceled'));
  end if;
end;
$$;

create unique index if not exists user_access_checkout_session_id_idx
on public.user_access (stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create unique index if not exists user_access_payment_intent_id_idx
on public.user_access (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create unique index if not exists user_access_subscription_id_idx
on public.user_access (stripe_subscription_id)
where stripe_subscription_id is not null;

create unique index if not exists user_access_subscription_schedule_id_idx
on public.user_access (stripe_subscription_schedule_id)
where stripe_subscription_schedule_id is not null;

drop trigger if exists set_user_access_updated_at on public.user_access;

create trigger set_user_access_updated_at
before update on public.user_access
for each row
execute function public.set_row_updated_at();

alter table public.user_access enable row level security;

revoke all on public.user_access from anon;
grant select on public.user_access to authenticated;

drop policy if exists "Users can read their own premium access" on public.user_access;

create policy "Users can read their own premium access"
on public.user_access
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

alter table public.stripe_webhook_events
add column if not exists event_type text not null default 'unknown';

alter table public.stripe_webhook_events
add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.stripe_webhook_events
add column if not exists received_at timestamptz not null default timezone('utc', now());

alter table public.stripe_webhook_events
add column if not exists processed_at timestamptz;

alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_webhook_events from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('catalog-previews', 'catalog-previews', true)
on conflict (id) do update
set public = excluded.public;
