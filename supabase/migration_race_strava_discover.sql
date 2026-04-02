-- Run in Supabase SQL editor if your project was created before these columns existed.
alter table races add column if not exists strava_activity_id text;
alter table races add column if not exists discover_race_id text;

create index if not exists races_user_strava_activity_idx on races (user_id, strava_activity_id)
  where strava_activity_id is not null;
