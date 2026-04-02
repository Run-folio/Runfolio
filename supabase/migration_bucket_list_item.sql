-- Distinguish races that belong to the user's bucket list UI from Strava-only completed entries.
-- is_bucket_list_item = false: completed major match not added as a bucket goal (no silent bucket completion).
-- Default true preserves legacy rows and normal "Add race" / bucket-goal flows.
alter table races add column if not exists is_bucket_list_item boolean default true;

update races set is_bucket_list_item = true where is_bucket_list_item is null;
