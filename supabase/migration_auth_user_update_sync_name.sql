-- Keep public.users.name aligned with auth when email or display name metadata changes.
-- Fixes /{username} lookup (get_public_profile_bundle matches users.name) vs AppNavbar (user_metadata.name).

create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(nullif(trim(new.email), ''), public.users.email), '@', 1)
  );
  if v_name is null or btrim(v_name) = '' then
    v_name := coalesce(nullif(trim(public.users.name), ''), 'Runner');
  end if;

  update public.users
  set
    email = coalesce(nullif(trim(new.email), ''), public.users.email),
    name = v_name
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.handle_auth_user_update();

comment on function public.handle_auth_user_update is
  'Mirrors auth email + metadata name into public.users so profile URLs stay consistent with the navbar.';
