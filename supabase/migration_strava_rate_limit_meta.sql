-- Persist Strava 429 classification for backfill UX (daily vs 15-minute window) and suggested retry time.

alter table public.user_strava_ingest_state
  add column if not exists strava_rate_limit_kind text null,
  add column if not exists strava_rate_limit_until timestamptz null;

comment on column public.user_strava_ingest_state.strava_rate_limit_kind is
  'Last Strava 429 classification: short_window | daily | unknown (see lib/strava-rate-limit.ts).';
comment on column public.user_strava_ingest_state.strava_rate_limit_until is
  'Suggested earliest retry instant (UTC). Daily limits use next UTC midnight; short-window uses Retry-After or ~15m.';
