-- Per-user Strava ingest cursors: separate historical backfill from incremental "new activity" sync.

create table if not exists user_strava_ingest_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /** Upper bound (epoch sec) for incremental sync: we request activities after this (minus overlap). */
  incremental_high_water_epoch integer,
  last_incremental_at timestamptz,
  /** Next Strava `before` filter (epoch sec) for backfill batches; null = next batch is “newest pages” pass. */
  backfill_before_epoch integer,
  /** True when a backfill batch returned no more activities to walk backward. */
  backfill_exhausted boolean not null default false,
  last_backfill_at timestamptz,
  backfill_batches_completed integer not null default 0,
  last_rate_limit_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists user_strava_ingest_state_updated_idx
  on user_strava_ingest_state (updated_at desc);

alter table user_strava_ingest_state enable row level security;

create policy "strava_ingest_state_select_own"
  on user_strava_ingest_state for select
  using (auth.uid() = user_id);

create policy "strava_ingest_state_insert_own"
  on user_strava_ingest_state for insert
  with check (auth.uid() = user_id);

create policy "strava_ingest_state_update_own"
  on user_strava_ingest_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "strava_ingest_state_delete_own"
  on user_strava_ingest_state for delete
  using (auth.uid() = user_id);

comment on table user_strava_ingest_state is
  'Tracks Strava list API cursors: bounded historical backfill vs incremental new-activity sync.';
