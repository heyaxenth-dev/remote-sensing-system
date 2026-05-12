-- Run this in the Supabase SQL Editor after creating your project.
-- Auth users (email + password) are managed by Supabase Auth.
-- This table stores extra app-specific profile data for each authenticated user.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'client',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Runs after Auth creates a row in auth.users (sign-up, admin invite, etc.).
-- Copies email and optional full_name from user metadata into public.profiles.
-- Role stays the table default ('client'); do not trust client-supplied role here.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_full_name text;
begin
  meta_full_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, meta_full_name)
  on conflict (id) do update
    set
      email = excluded.email,
      full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profile email in sync when the auth user email changes (e.g. change-email flow).
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.handle_auth_user_updated();

-- Regional soil reference rows for recommendation context (bounding boxes on WGS84).
create table if not exists public.soil_types (
  id uuid primary key default gen_random_uuid(),
  region_label text not null,
  ph numeric not null,
  drainage text not null check (drainage in ('poor','medium','good')),
  texture text not null check (texture in ('sandy','loam','clay')),
  lat_min double precision not null,
  lat_max double precision not null,
  lon_min double precision not null,
  lon_max double precision not null
);

alter table public.soil_types enable row level security;

create policy "Authenticated users can read soil_types"
on public.soil_types
for select
to authenticated
using (true);

insert into public.soil_types (region_label, ph, drainage, texture, lat_min, lat_max, lon_min, lon_max)
select 'Western Visayas sample loam', 6.4, 'medium', 'loam', 10.5, 12.5, 121.0, 123.5
where not exists (
  select 1 from public.soil_types where region_label = 'Western Visayas sample loam'
);

insert into public.soil_types (region_label, ph, drainage, texture, lat_min, lat_max, lon_min, lon_max)
select 'Philippines default reference', 6.3, 'medium', 'loam', -90, 90, -180, 180
where not exists (
  select 1 from public.soil_types where region_label = 'Philippines default reference'
);

-- Field officer tracking for selected seedlings (simple CRUD / status updates).
create table if not exists public.seedling_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seedling_id text not null,
  common_name text,
  scientific_name text,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seedling_progress_user_idx
  on public.seedling_progress (user_id);

alter table public.seedling_progress enable row level security;

create policy "Users manage own seedling_progress"
on public.seedling_progress
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Mobile field captures + monitor picks (read by admin dashboard; open policies — anon key only).
create table if not exists public.monitoring_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('scene_analysis', 'monitor_seedling')),
  latitude double precision not null,
  longitude double precision not null,
  estimated_seedlings_needed integer not null,
  seedling_id text,
  common_name text,
  scientific_name text,
  confidence numeric,
  rationale text,
  unsuitable_for_planting boolean not null default false,
  raw_analysis jsonb,
  image_url text
);

create index if not exists monitoring_submissions_created_idx
  on public.monitoring_submissions (created_at desc);

alter table public.monitoring_submissions enable row level security;

create policy "Anyone can insert monitoring_submissions"
on public.monitoring_submissions
for insert
to anon, authenticated
with check (true);

create policy "Anyone can read monitoring_submissions"
on public.monitoring_submissions
for select
to anon, authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Storage: confirmed capture JPEGs (mobile uploads; public URLs for admin UI)
-- Run once after enabling Storage. Bucket must exist before app upload.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('field-captures', 'field-captures', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "field_captures_public_read" on storage.objects;
create policy "field_captures_public_read"
on storage.objects for select
using (bucket_id = 'field-captures');

drop policy if exists "field_captures_insert_anon_auth" on storage.objects;
create policy "field_captures_insert_anon_auth"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'field-captures');
