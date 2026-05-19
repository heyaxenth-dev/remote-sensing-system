-- Reforestation monitoring alignment (DENR-CENRO Culasi study objectives).
-- Run in Supabase SQL Editor after base schema.sql.

-- ---------------------------------------------------------------------------
-- Reforestation plots (central geospatial registry — plot centroids)
-- ---------------------------------------------------------------------------
create table if not exists public.reforestation_plots (
  id uuid primary key default gen_random_uuid(),
  plot_code text not null unique,
  name text not null,
  barangay text,
  municipality text not null default 'Culasi',
  latitude double precision not null,
  longitude double precision not null,
  target_seedlings integer not null default 0,
  program_year integer,
  created_at timestamptz not null default now()
);

create index if not exists reforestation_plots_municipality_idx
  on public.reforestation_plots (municipality);

alter table public.reforestation_plots enable row level security;

drop policy if exists "Anyone can read reforestation_plots" on public.reforestation_plots;
create policy "Anyone can read reforestation_plots"
on public.reforestation_plots
for select
to anon, authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Extend monitoring_submissions (field attribution, plot, verification)
-- ---------------------------------------------------------------------------
alter table public.monitoring_submissions
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists plot_id uuid references public.reforestation_plots(id) on delete set null,
  add column if not exists grid_cell text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_notes text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- Backfill constraint for verification_status (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'monitoring_submissions_verification_status_check'
  ) then
    alter table public.monitoring_submissions
      add constraint monitoring_submissions_verification_status_check
      check (verification_status in ('pending', 'confirmed', 'flagged'));
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists monitoring_submissions_plot_idx
  on public.monitoring_submissions (plot_id);

create index if not exists monitoring_submissions_verification_idx
  on public.monitoring_submissions (verification_status);

-- ---------------------------------------------------------------------------
-- Link seedling progress to plots (survival tracking per reforestation site)
-- ---------------------------------------------------------------------------
alter table public.seedling_progress
  add column if not exists plot_id uuid references public.reforestation_plots(id) on delete set null;

create index if not exists seedling_progress_plot_idx
  on public.seedling_progress (plot_id);

-- ---------------------------------------------------------------------------
-- Profile roles: Planning Officer, Forest Ranger, Admin (study roles)
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role in (
      'client',
      'forest_ranger',
      'planning_officer',
      'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Demo plots — Culasi, Antique (Western Visayas reference coordinates)
-- ---------------------------------------------------------------------------
insert into public.reforestation_plots (plot_code, name, barangay, municipality, latitude, longitude, target_seedlings, program_year)
select 'CUL-A1', 'Culasi Reforestation Plot A1', 'Culasi', 'Culasi', 11.2886, 122.0340, 420, 2025
where not exists (select 1 from public.reforestation_plots where plot_code = 'CUL-A1');

insert into public.reforestation_plots (plot_code, name, barangay, municipality, latitude, longitude, target_seedlings, program_year)
select 'CUL-B1', 'Culasi Reforestation Plot B1', 'Bacong', 'Culasi', 11.2950, 122.0410, 380, 2025
where not exists (select 1 from public.reforestation_plots where plot_code = 'CUL-B1');

insert into public.reforestation_plots (plot_code, name, barangay, municipality, latitude, longitude, target_seedlings, program_year)
select 'TIB-A3', 'Tibiao Community Plot A3', 'Tibiao', 'Tibiao', 11.2510, 122.0530, 350, 2024
where not exists (select 1 from public.reforestation_plots where plot_code = 'TIB-A3');

insert into public.reforestation_plots (plot_code, name, barangay, municipality, latitude, longitude, target_seedlings, program_year)
select 'LIB-B2', 'Libertad Watershed Plot B2', 'Libertad', 'Libertad', 11.2720, 122.0180, 300, 2024
where not exists (select 1 from public.reforestation_plots where plot_code = 'LIB-B2');

-- Allow authenticated users to update verification fields (admin reviewers)
drop policy if exists "Authenticated can update monitoring_submissions verification" on public.monitoring_submissions;
create policy "Authenticated can update monitoring_submissions verification"
on public.monitoring_submissions
for update
to authenticated
using (true)
with check (true);
