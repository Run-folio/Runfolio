-- Distinguish Strava sync vs file-based imports (FIT/GPX/TCX) in the same `strava_synced_activities` table.

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
