-- Story + gallery enrichment for Strava-linked portfolio entries
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

create unique index if not exists races_user_strava_activity_unique
  on races (user_id, strava_activity_id)
  where strava_activity_id is not null and length(trim(strava_activity_id)) > 0;
