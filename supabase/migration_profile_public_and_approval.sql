-- Public profile reads (fixes empty profile for visitors: RLS previously hid other users' rows).
-- Profile approval: only races with include_on_profile = true appear in portfolio highlights.
-- Dismissals: hide Strava candidates after "Not this race" (durable).

alter table races add column if not exists include_on_profile boolean default true;

update races set include_on_profile = true where include_on_profile is null;

create table if not exists strava_profile_dismissals (
  user_id uuid not null references users(id) on delete cascade,
  strava_activity_id text not null,
  created_at timestamptz default now(),
  primary key (user_id, strava_activity_id)
);

alter table strava_profile_dismissals enable row level security;

create policy "Users manage own strava dismissals"
  on strava_profile_dismissals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Returns runner id+name (no email) and all race rows for that user — callable by anon/auth clients.
create or replace function get_public_profile_bundle(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  rname text;
  races_json jsonb;
begin
  select u.id, u.name into rid, rname
  from users u
  where lower(u.name) = lower(trim(p_username))
  limit 1;

  if rid is null then
    return jsonb_build_object('runner', null, 'races', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  into races_json
  from races r
  where r.user_id = rid;

  return jsonb_build_object(
    'runner', jsonb_build_object('id', rid, 'name', rname),
    'races', coalesce(races_json, '[]'::jsonb)
  );
end;
$$;

grant execute on function get_public_profile_bundle(text) to anon;
grant execute on function get_public_profile_bundle(text) to authenticated;
