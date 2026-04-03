-- Public discovery: list runners who published a finish for a catalog race (no activity feed).
-- SECURITY DEFINER bypasses RLS on `races` while enforcing public profile + published finish rules.

create or replace function list_public_finishers_for_discover_race(p_discover_race_id text, p_limit int default 48)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int := greatest(1, least(coalesce(nullif(p_limit, 0), 48), 200));
begin
  if p_discover_race_id is null or trim(p_discover_race_id) = '' then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_json order by ord desc nulls last)
      from (
        select
          jsonb_build_object(
            'user_id', t.user_id,
            'runner_name', t.runner_name,
            'race_id', t.race_id,
            'finish_date', t.finish_date
          ) as row_json,
          t.finish_date as ord
        from (
          select distinct on (r.user_id)
            r.user_id,
            u.name as runner_name,
            r.id::text as race_id,
            r.date as finish_date
          from races r
          inner join users u on u.id = r.user_id
          where r.discover_race_id = trim(p_discover_race_id)
            and r.is_completed = true
            and r.profile_approved_at is not null
            and coalesce(r.include_on_profile, true) = true
            and coalesce(u.profile_public, true) = true
            and (
              coalesce(r.strava_activity_id, '') <> ''
              or coalesce(r.discover_race_id, '') <> ''
            )
          order by r.user_id, r.date desc nulls last
          limit lim
        ) t
      ) u
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function list_public_finishers_for_discover_race(text, int) to anon;
grant execute on function list_public_finishers_for_discover_race(text, int) to authenticated;


create or replace function list_public_finishers_for_canonical_race(p_canonical_race_id uuid, p_limit int default 48)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int := greatest(1, least(coalesce(nullif(p_limit, 0), 48), 200));
begin
  if p_canonical_race_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_json order by ord desc nulls last)
      from (
        select
          jsonb_build_object(
            'user_id', t.user_id,
            'runner_name', t.runner_name,
            'race_id', t.race_id,
            'finish_date', t.finish_date
          ) as row_json,
          t.finish_date as ord
        from (
          select distinct on (r.user_id)
            r.user_id,
            u.name as runner_name,
            r.id::text as race_id,
            r.date as finish_date
          from races r
          inner join users u on u.id = r.user_id
          where r.canonical_race_id = p_canonical_race_id
            and r.is_completed = true
            and r.profile_approved_at is not null
            and coalesce(r.include_on_profile, true) = true
            and coalesce(u.profile_public, true) = true
            and (
              coalesce(r.strava_activity_id, '') <> ''
              or coalesce(r.discover_race_id, '') <> ''
              or r.canonical_race_id is not null
            )
          order by r.user_id, r.date desc nulls last
          limit lim
        ) t
      ) u
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function list_public_finishers_for_canonical_race(uuid, int) to anon;
grant execute on function list_public_finishers_for_canonical_race(uuid, int) to authenticated;


create index if not exists races_public_finishers_discover_idx
  on races (discover_race_id)
  where profile_approved_at is not null
    and is_completed = true
    and coalesce(include_on_profile, true) = true;

create index if not exists races_public_finishers_canonical_idx
  on races (canonical_race_id)
  where profile_approved_at is not null
    and is_completed = true
    and coalesce(include_on_profile, true) = true;
