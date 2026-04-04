-- Background canonical race enrichment: queue + extended metadata for web-sourced fields.

alter table canonical_races
  add column if not exists long_description text,
  add column if not exists fallback_image_url text,
  add column if not exists distance_options_km double precision[] not null default '{}',
  add column if not exists enrichment_status text not null default 'never',
  add column if not exists last_enriched_at timestamptz,
  add column if not exists enrichment_meta jsonb not null default '{}'::jsonb;

alter table canonical_races
  drop constraint if exists canonical_races_enrichment_status_chk;

alter table canonical_races
  add constraint canonical_races_enrichment_status_chk
  check (enrichment_status in ('never', 'queued', 'running', 'complete', 'failed', 'skipped'));

comment on column canonical_races.long_description is 'Longer editorial / source copy; short card copy may stay in description.';
comment on column canonical_races.fallback_image_url is 'Branded or series fallback when hero_image_url is empty (may be app-generated URL).';
comment on column canonical_races.distance_options_km is 'Multiple distances when parsed from page (e.g. 21, 42).';
comment on column canonical_races.enrichment_meta is 'Scores, provenance, image selection debug (JSON).';

create index if not exists canonical_races_enrichment_status_idx
  on canonical_races (enrichment_status, last_enriched_at);

-- Job queue: workers claim rows; no page-load work.
create table if not exists canonical_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references canonical_races (id) on delete cascade,
  status text not null default 'queued',
  priority integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  constraint canonical_enrichment_jobs_status_chk
    check (status in ('queued', 'running', 'done', 'failed', 'skipped'))
);

create index if not exists canonical_enrichment_jobs_claim_idx
  on canonical_enrichment_jobs (status, priority desc, scheduled_for, created_at);

-- At most one active job per race (queued or running).
create unique index if not exists canonical_enrichment_jobs_one_active_per_race
  on canonical_enrichment_jobs (race_id)
  where status in ('queued', 'running');

alter table canonical_enrichment_jobs enable row level security;
