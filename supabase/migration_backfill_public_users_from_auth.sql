-- One-time repair: users who registered before auth→public.users triggers existed.
-- Safe to re-run: only inserts missing ids.

insert into public.users (id, email, name, created_at)
select
  au.id,
  coalesce(nullif(trim(au.email), ''), 'user-' || replace(au.id::text, '-', '') || '@runfolio.internal'),
  coalesce(
    nullif(trim(au.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(nullif(trim(au.email), ''), 'runner@runfolio.internal'), '@', 1),
    'Runner'
  ),
  coalesce(au.created_at, now())
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name;
