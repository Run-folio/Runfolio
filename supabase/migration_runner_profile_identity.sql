-- Running profile / identity layer: curation timestamps, featured flags, synced activity picks, runner bio.
-- Prerequisite: `canonical_races` must exist (migration_canonical_races.sql) because `get_public_profile_bundle` joins it.

alter table users add column if not exists profile_location text;
alter table users add column if not exists profile_tagline text;
alter table users add column if not exists profile_public boolean not null default true;

alter table races add column if not exists profile_approved_at timestamptz;
alter table races add column if not exists profile_featured boolean not null default false;

comment on column races.profile_approved_at is 'When the runner published this finish on their public profile; null = eligible but not shown.';
comment on column races.profile_featured is 'Highlight on profile “spotlight” when true and profile_approved_at is set.';

alter table strava_synced_activities add column if not exists profile_include boolean not null default false;

comment on column strava_synced_activities.profile_include is 'User-approved representative effort for profile (not full Strava feed).';

-- Existing portfolio-visible finishes keep public presence after migration.
update races r
set profile_approved_at = coalesce(r.created_at::timestamptz, now())
where r.is_completed = true
  and coalesce(r.include_on_profile, true) = true
  and (r.strava_activity_id is not null or r.discover_race_id is not null)
  and r.profile_approved_at is null;

-- Manual / editor-completed rows that were already public
update races r
set profile_approved_at = coalesce(r.created_at::timestamptz, now())
where r.is_completed = true
  and coalesce(r.include_on_profile, true) = true
  and r.profile_approved_at is null
  and r.strava_activity_id is null
  and r.discover_race_id is null;

create or replace function get_public_profile_bundle(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  rname text;
  rloc text;
  rtag text;
  rpub boolean;
  races_json jsonb;
begin
  select
    u.id,
    u.name,
    u.profile_location,
    u.profile_tagline,
    coalesce(u.profile_public, true)
  into rid, rname, rloc, rtag, rpub
  from users u
  where lower(u.name) = lower(trim(p_username))
  limit 1;

  if rid is null then
    return jsonb_build_object('runner', null, 'races', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(r)
      || jsonb_strip_nulls(jsonb_build_object(
        'canonical_logo_url', cr.logo_url,
        'canonical_hero_url', cr.hero_image_url
      ))
    ),
    '[]'::jsonb
  )
  into races_json
  from races r
  left join canonical_races cr on cr.id = r.canonical_race_id
  where r.user_id = rid;

  return jsonb_build_object(
    'runner', jsonb_build_object(
      'id', rid,
      'name', rname,
      'profile_location', rloc,
      'profile_tagline', rtag,
      'profile_public', rpub
    ),
    'races', coalesce(races_json, '[]'::jsonb)
  );
end;
$$;

grant execute on function get_public_profile_bundle(text) to anon;
grant execute on function get_public_profile_bundle(text) to authenticated;
