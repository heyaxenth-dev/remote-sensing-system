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
    trim(coalesce(new.raw_user_meta_data->>'full_name', '')),
    ''
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, meta_full_name)
  on conflict (id) do nothing;

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
