-- Throttle repeated clicks on the first historical backfill batch (Strava quota protection).

alter table public.user_strava_ingest_state
  add column if not exists first_backfill_last_attempt_at timestamptz null;

comment on column public.user_strava_ingest_state.first_backfill_last_attempt_at is
  'Last time the user started the first backfill batch (batches=0, before cursor null). Used for cooldown between attempts.';
