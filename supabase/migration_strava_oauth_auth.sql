-- Strava-only auth support: link auth user to Strava athlete id; store tokens server-side (RLS locked).
-- Apply after public.users exists. Service role reads/writes tokens; no policies => JWT roles cannot access.

alter table public.users add column if not exists strava_athlete_id text unique;

comment on column public.users.strava_athlete_id is
  'Strava athlete id (string); lookup key for OAuth login / reconnect.';

create table if not exists public.strava_user_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);

create index if not exists strava_user_credentials_athlete_id_idx
  on public.strava_user_credentials (athlete_id);

alter table public.strava_user_credentials enable row level security;

comment on table public.strava_user_credentials is
  'Strava OAuth tokens per Runfolio user. No GRANT to anon/authenticated — use service role in server code only.';
