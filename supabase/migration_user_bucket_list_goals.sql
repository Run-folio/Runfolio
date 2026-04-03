-- User goals tied to canonical races (stable internal IDs). Distinct from portfolio `races` rows until linked.

create table if not exists user_bucket_list_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canonical_race_id uuid not null references canonical_races (id) on delete cascade,
  status text not null default 'planned',
  added_at timestamptz not null default now(),
  completed_at timestamptz,
  linked_strava_activity_id text,
  linked_user_race_id uuid references races (id) on delete set null,
  profile_approved_at timestamptz,
  notes text,
  constraint user_bucket_list_goals_status_chk check (status in (
    'saved', 'planned', 'completed_unlinked', 'completed_linked', 'featured_on_profile'
  )),
  unique (user_id, canonical_race_id)
);

create index if not exists user_bucket_list_goals_user_status_idx
  on user_bucket_list_goals (user_id, status);

alter table user_bucket_list_goals enable row level security;

create policy "user_bucket_list_goals_select_own"
  on user_bucket_list_goals for select
  using (auth.uid() = user_id);

create policy "user_bucket_list_goals_insert_own"
  on user_bucket_list_goals for insert
  with check (auth.uid() = user_id);

create policy "user_bucket_list_goals_update_own"
  on user_bucket_list_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_bucket_list_goals_delete_own"
  on user_bucket_list_goals for delete
  using (auth.uid() = user_id);

-- Let signed-in users read active canonical races (search / add flow) and any race on their bucket list.
create policy "canonical_races_select_active_authenticated"
  on canonical_races for select
  to authenticated
  using (status = 'active');

create policy "canonical_races_select_bucket_authenticated"
  on canonical_races for select
  to authenticated
  using (
    id in (select canonical_race_id from user_bucket_list_goals where user_id = auth.uid())
  );
