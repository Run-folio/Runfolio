-- Public bucket for race portfolio uploads; paths are `${auth.uid()}/${strava_activity_id}/…`.
-- Run in Supabase SQL editor or via CLI after reviewing policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'race-portfolio-photos',
  'race-portfolio-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "race_port_photos_public_read" on storage.objects;
drop policy if exists "race_port_photos_insert_own" on storage.objects;
drop policy if exists "race_port_photos_update_own" on storage.objects;
drop policy if exists "race_port_photos_delete_own" on storage.objects;

create policy "race_port_photos_public_read"
on storage.objects for select
using (bucket_id = 'race-portfolio-photos');

create policy "race_port_photos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'race-portfolio-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

create policy "race_port_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'race-portfolio-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

create policy "race_port_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'race-portfolio-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);
