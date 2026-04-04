-- Strava profile picture URL for navbar (athlete.profile_medium from Strava API).
-- Apply after public.users exists.
alter table public.users add column if not exists strava_profile_url text;

comment on column public.users.strava_profile_url is
  'Strava athlete profile_medium URL; set on OAuth connect and when missing during sync.';
