-- Consolidated additive schema for `strava_synced_activities` (and one `races` column from ingest v2).
-- Run in Supabase SQL Editor when production is missing columns the app expects (PostgREST 42703 or schema cache errors).
--
-- Original sources (apply individual files in MIGRATION_ORDER.txt for greenfield projects):
--   manual_link_only     → migration_strava_ingest_v2.sql
--   activity_source      → migration_activity_file_source.sql
--   match_hub_status     → migration_match_hub.sql
--   profile_include      → migration_runner_profile_identity.sql (strava_synced_activities line only)
--   races.linked_activity_snapshot → migration_strava_ingest_v2.sql
--
-- Safe to re-run: IF NOT EXISTS columns, IF NOT EXISTS indexes, DROP CONSTRAINT IF EXISTS before ADD CHECK.

-- ---------------------------------------------------------------------------
-- strava_synced_activities.manual_link_only (migration_strava_ingest_v2.sql)
-- ---------------------------------------------------------------------------
alter table strava_synced_activities
  add column if not exists manual_link_only boolean not null default false;

create index if not exists strava_synced_activities_user_manual_link_idx
  on strava_synced_activities (user_id, manual_link_only)
  where linked_portfolio_race_id is null;

comment on column strava_synced_activities.manual_link_only is
  'When true, activity is kept for manual Strava linking only (below default import bar); excluded from auto match hub queue.';

-- ---------------------------------------------------------------------------
-- strava_synced_activities.activity_source (migration_activity_file_source.sql)
-- ---------------------------------------------------------------------------
alter table strava_synced_activities
  add column if not exists activity_source text not null default 'strava';

alter table strava_synced_activities
  drop constraint if exists strava_synced_activities_activity_source_check;

alter table strava_synced_activities
  add constraint strava_synced_activities_activity_source_check
  check (activity_source in ('strava', 'garmin_file', 'manual_file'));

comment on column strava_synced_activities.activity_source is
  'strava: from Strava API sync; garmin_file: typically .fit; manual_file: GPX/TCX or other exports.';

create index if not exists strava_synced_activities_user_source_idx
  on strava_synced_activities (user_id, activity_source);

-- ---------------------------------------------------------------------------
-- strava_synced_activities.match_hub_status (migration_match_hub.sql)
-- ---------------------------------------------------------------------------
alter table strava_synced_activities add column if not exists match_hub_status text;

comment on column strava_synced_activities.match_hub_status is
  'Hub: not_race = not an event; snoozed = review later. Null = normal queue when other gates pass.';

create index if not exists strava_synced_activities_user_hub_idx
  on strava_synced_activities (user_id, match_hub_status)
  where linked_portfolio_race_id is null;

-- ---------------------------------------------------------------------------
-- strava_synced_activities.profile_include (migration_runner_profile_identity.sql)
-- ---------------------------------------------------------------------------
alter table strava_synced_activities add column if not exists profile_include boolean not null default false;

comment on column strava_synced_activities.profile_include is
  'User-approved representative effort for profile (not full Strava feed).';

-- ---------------------------------------------------------------------------
-- races.linked_activity_snapshot (migration_strava_ingest_v2.sql — used by portfolio / Strava confirm)
-- ---------------------------------------------------------------------------
alter table races
  add column if not exists linked_activity_snapshot jsonb;

comment on column races.linked_activity_snapshot is
  'Immutable Strava activity summary at link time for portfolio without live Strava API.';
