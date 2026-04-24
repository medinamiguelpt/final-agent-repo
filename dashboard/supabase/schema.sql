-- ──────────────────────────────────────────────────────────────────────────────
-- Greek Barber Dashboard — Full Database Schema
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Run it once on a fresh project. It is idempotent (IF NOT EXISTS / OR REPLACE).
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";


-- ── businesses ────────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  slug              text        unique not null,
  phone             text,
  email             text,
  address           text,
  city              text,
  country           text,
  description       text,
  hours             text,          -- JSON: { mon: { open, close, closed }, … }
  barbers           text,          -- comma-separated barber names
  website           text,
  owner_id          uuid        references auth.users(id) on delete set null,
  approved          boolean     not null default true,
  plan              text        not null default 'demo',
  logo_url          text,
  timezone          text,
  -- Per-business profile blob (ownerName, size, postcode, twoFactorEnabled, agentId).
  -- The other fields (name, phone, email, address, city, country, hours, barbers,
  -- website) already exist as dedicated columns and are kept in sync.
  profile           jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();


-- ── agents ────────────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id                    uuid        primary key default gen_random_uuid(),
  business_id           uuid        not null references public.businesses(id) on delete cascade,
  elevenlabs_agent_id   text        not null,
  name                  text        not null,
  active                boolean     not null default true,
  calendar_config       jsonb       not null default '{}',
  created_at            timestamptz not null default now()
);

create index if not exists agents_business_id_idx on public.agents(business_id);
create index if not exists agents_elevenlabs_id_idx on public.agents(elevenlabs_agent_id);


-- ── calls ─────────────────────────────────────────────────────────────────────
create table if not exists public.calls (
  id                  uuid        primary key default gen_random_uuid(),
  business_id         uuid        not null references public.businesses(id) on delete cascade,
  agent_id            uuid        references public.agents(id) on delete set null,
  conversation_id     text        unique not null,
  status              text        not null default 'done',
  client_name         text,
  phone_number        text,
  service_type        text,
  barber_name         text,
  appointment_date    date,
  appointment_time    time,
  price               numeric,
  duration_minutes    integer,
  special_requests    text,
  call_language       text,
  callback_requested  boolean,
  appointment_status  text,
  summary             text,
  call_duration_secs  integer,
  message_count       integer,
  main_language       text,
  call_successful     text,
  termination_reason  text,
  call_summary_title  text,
  raw_data            jsonb       not null default '{}',
  source              text        not null default 'ai_call',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists calls_business_id_idx     on public.calls(business_id);
create index if not exists calls_conversation_id_idx on public.calls(conversation_id);
create index if not exists calls_created_at_idx      on public.calls(created_at desc);

create or replace trigger calls_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();


-- ── appointments ──────────────────────────────────────────────────────────────
create table if not exists public.appointments (
  id                uuid        primary key default gen_random_uuid(),
  business_id       uuid        not null references public.businesses(id) on delete cascade,
  call_id           uuid        unique references public.calls(id) on delete set null,
  source            text        not null,   -- 'ai_call' | 'walk-in' | 'manual' | 'website'
  client_name       text,
  phone_number      text,
  service_type      text,
  barber_name       text,
  appointment_date  date,
  appointment_time  time,
  duration_minutes  integer,
  price             numeric,
  status            text        not null default 'confirmed',
  notes             text,
  services          jsonb,      -- multi-service array: [{ service, barber, price, duration_minutes }]
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists appointments_business_id_idx on public.appointments(business_id);
create index if not exists appointments_date_idx        on public.appointments(appointment_date);

create or replace trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();


-- ── profiles ──────────────────────────────────────────────────────────────────
-- One row per auth.users row. Created automatically via trigger below.
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        text,
  approved    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, approved)
  values (new.id, new.email, true)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── business_members ──────────────────────────────────────────────────────────
create table if not exists public.business_members (
  business_id uuid        not null references public.businesses(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null default 'member',  -- 'owner' | 'member'
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index if not exists business_members_user_id_idx on public.business_members(user_id);


-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.businesses       enable row level security;
alter table public.agents           enable row level security;
alter table public.calls            enable row level security;
alter table public.appointments     enable row level security;
alter table public.profiles         enable row level security;
alter table public.business_members enable row level security;

-- businesses: owners can insert; members can read; owners can update/delete
create policy "Owners can insert businesses"
  on public.businesses for insert
  with check (owner_id = auth.uid());

create policy "Members can read their businesses"
  on public.businesses for select
  using (
    owner_id = auth.uid()
    or id in (select business_id from public.business_members where user_id = auth.uid())
  );

create policy "Owners can update their businesses"
  on public.businesses for update
  using (owner_id = auth.uid());

create policy "Owners can delete their businesses"
  on public.businesses for delete
  using (owner_id = auth.uid());

-- agents: members of the business can read; owners can write
create policy "Members can read agents"
  on public.agents for select
  using (
    business_id in (select business_id from public.business_members where user_id = auth.uid())
  );

-- calls: members of the business can read; service role writes via webhook (bypasses RLS automatically)
create policy "Members can read calls"
  on public.calls for select
  using (
    business_id in (select business_id from public.business_members where user_id = auth.uid())
  );

-- appointments: members can read/write
create policy "Members can read appointments"
  on public.appointments for select
  using (
    business_id in (select business_id from public.business_members where user_id = auth.uid())
  );

create policy "Members can insert appointments"
  on public.appointments for insert
  with check (
    business_id in (select business_id from public.business_members where user_id = auth.uid())
  );

create policy "Members can update appointments"
  on public.appointments for update
  using (
    business_id in (select business_id from public.business_members where user_id = auth.uid())
  );

-- Note: service_role key bypasses RLS automatically — no extra policy needed for webhook writes.

-- profiles: users can read/update their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- business_members: users can read their own memberships; owners can insert
create policy "Users can read own memberships"
  on public.business_members for select
  using (user_id = auth.uid());

create policy "Users can insert their own membership"
  on public.business_members for insert
  with check (user_id = auth.uid());
