-- Keep public.users in sync with auth.users so RLS-scoped app code always has a profile row.
-- Required for: persistence readiness, FK from races / strava_profile_dismissals, public profiles.
--
-- Apply AFTER supabase/schema.sql (users table must exist).
-- Safe to re-run: replaces function + drops/recreates trigger.
--
-- Recommended migration order (dependencies):
--   1. schema.sql
--   2. migration_race_strava_discover.sql
--   3. migration_activity_portfolio.sql
--   4. migration_bucket_list_item.sql
--   5. migration_profile_public_and_approval.sql
--   6. migration_canonical_races.sql
--   7. migration_user_bucket_list_goals.sql
--   8. migration_strava_synced_activities.sql  (FK races.canonical_race_id → canonical_races)
--   9. migration_match_hub.sql
--  10. migration_runner_profile_identity.sql
--  11. migration_race_catalog_imports.sql
--  12. migration_auth_users_sync.sql  (this file)
--  13. migration_strava_canonical_dismissals_update.sql

create or replace function public.handle_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name text;
begin
  v_email := coalesce(nullif(trim(new.email), ''), 'user-' || new.id::text || '@runfolio.internal');
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(nullif(trim(new.email), ''), v_email), '@', 1)
  );
  if v_name = '' or v_name is null then
    v_name := 'Runner';
  end if;

  insert into public.users (id, email, name)
  values (new.id, v_email, v_name)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(trim(excluded.name), ''), public.users.name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_insert();

comment on function public.handle_auth_user_insert is
  'Mirrors auth.users into public.users for app FKs and RLS; SECURITY DEFINER bypasses users RLS.';
