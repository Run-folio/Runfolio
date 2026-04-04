-- Strava ingest v2: distinguish high-signal match queue vs manual-link-only cache; durable race ↔ activity snapshot.
--
-- **Required for current app code.** Without `manual_link_only`, PostgREST returns 42703 on sync/backfill
-- (select/insert/update reference this column). Apply via MIGRATION_ORDER.txt (step including this file).

alter table strava_synced_activities
  add column if not exists manual_link_only boolean not null default false;

create index if not exists strava_synced_activities_user_manual_link_idx
  on strava_synced_activities (user_id, manual_link_only)
  where linked_portfolio_race_id is null;

alter table races
  add column if not exists linked_activity_snapshot jsonb;

comment on column strava_synced_activities.manual_link_only is
  'When true, activity is kept for manual Strava linking only (below default import bar); excluded from auto match hub queue.';
comment on column races.linked_activity_snapshot is
  'Immutable Strava activity summary at link time for portfolio without live Strava API.';
