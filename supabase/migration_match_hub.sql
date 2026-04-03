-- Match & Import hub: user resolution for synced Strava activities (orthogonal to heuristic potential_race_activity).
-- Allowed values (app-enforced): null | not_race | snoozed

alter table strava_synced_activities add column if not exists match_hub_status text;

comment on column strava_synced_activities.match_hub_status is
  'Hub: not_race = not an event; snoozed = review later. Null = normal queue when other gates pass.';

create index if not exists strava_synced_activities_user_hub_idx
  on strava_synced_activities (user_id, match_hub_status)
  where linked_portfolio_race_id is null;
