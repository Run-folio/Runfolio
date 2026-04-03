create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key,
  email text unique not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  location text,
  date date,
  distance_km numeric,
  elevation_m numeric,
  time text,
  description text,
  is_completed boolean default true,
  signup_url text,
  created_at timestamptz default now()
);

-- If the table already exists from an earlier setup, run:
-- alter table races add column if not exists signup_url text;

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  strava_id text not null,
  name text not null,
  distance_km numeric,
  moving_time text,
  date date,
  start_lat numeric,
  start_lng numeric,
  polyline text,
  description text,
  created_at timestamptz default now()
);

create table if not exists activity_race_links (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  race_id uuid not null references races(id) on delete cascade,
  confidence_score numeric
);

alter table users enable row level security;
alter table races enable row level security;
alter table activities enable row level security;
alter table activity_race_links enable row level security;

create policy "Users can read own user row"
  on users for select
  using (auth.uid() = id);

create policy "Users can upsert own user row"
  on users for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can manage own races"
  on races for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own activities"
  on activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own links"
  on activity_race_links for all
  using (
    exists (
      select 1 from races
      where races.id = activity_race_links.race_id
      and races.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from races
      where races.id = activity_race_links.race_id
      and races.user_id = auth.uid()
    )
  );

-- Strava ↔ known-race confirmation (run migration_race_strava_discover.sql on existing DBs)
alter table races add column if not exists strava_activity_id text;
alter table races add column if not exists discover_race_id text;

-- Activity portfolio / reflections (run migration_activity_portfolio.sql)
alter table races add column if not exists race_subtitle text;
alter table races add column if not exists reflection_toughest text;
alter table races add column if not exists reflection_learned text;
alter table races add column if not exists reflection_mattered text;
alter table races add column if not exists finish_notes text;
alter table races add column if not exists manual_photo_urls text[];
alter table races add column if not exists tag_pb boolean default false;
alter table races add column if not exists tag_career_highlight boolean default false;
alter table races add column if not exists tag_hardest boolean default false;
alter table races add column if not exists tag_bucket_list_done boolean default false;

-- Bucket list membership vs Strava-only completion (migration_bucket_list_item.sql)
alter table races add column if not exists is_bucket_list_item boolean default true;

-- Public profile RPC, include_on_profile, strava dismissals — see migration_profile_public_and_approval.sql

-- App-owned canonical races + per-provider sources: apply migration_canonical_races.sql (not duplicated here).
-- User bucket list ↔ canonical races: migration_user_bucket_list_goals.sql
