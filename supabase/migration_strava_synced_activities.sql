-- Local cache of Strava activities per user: sync, race detection, canonical matching.

create table if not exists strava_synced_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  strava_activity_id text not null,
  name text not null,
  description text,
  distance_m double precision,
  distance_km double precision,
  elevation_gain_m double precision,
  moving_time_sec integer,
  elapsed_time_sec integer,
  start_date timestamptz not null,
  timezone text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  polyline text,
  photos jsonb not null default '[]'::jsonb,
  sport_type text,
  activity_type text,
  kudos_count integer default 0,
  achievement_count integer default 0,
  potential_race_activity boolean not null default false,
  strava_updated_at timestamptz,
  payload_hash text,
  linked_portfolio_race_id uuid references races (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, strava_activity_id)
);

create index if not exists strava_synced_activities_user_potential_idx
  on strava_synced_activities (user_id, potential_race_activity)
  where linked_portfolio_race_id is null;

create index if not exists strava_synced_activities_user_start_idx
  on strava_synced_activities (user_id, start_date desc);

alter table strava_synced_activities enable row level security;

create policy "strava_synced_select_own"
  on strava_synced_activities for select
  using (auth.uid() = user_id);

create policy "strava_synced_insert_own"
  on strava_synced_activities for insert
  with check (auth.uid() = user_id);

create policy "strava_synced_update_own"
  on strava_synced_activities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "strava_synced_delete_own"
  on strava_synced_activities for delete
  using (auth.uid() = user_id);

-- User dismissed “not this race” for canonical matcher (per activity).
create table if not exists strava_canonical_match_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  strava_activity_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, strava_activity_id)
);

alter table strava_canonical_match_dismissals enable row level security;

create policy "strava_canon_dismiss_select_own"
  on strava_canonical_match_dismissals for select
  using (auth.uid() = user_id);

create policy "strava_canon_dismiss_insert_own"
  on strava_canonical_match_dismissals for insert
  with check (auth.uid() = user_id);

create policy "strava_canon_dismiss_delete_own"
  on strava_canonical_match_dismissals for delete
  using (auth.uid() = user_id);

-- Portfolio row ↔ canonical race (optional; discover_race_id may still be null).
alter table races add column if not exists canonical_race_id uuid references canonical_races (id) on delete set null;

create index if not exists races_canonical_race_id_idx on races (canonical_race_id);
