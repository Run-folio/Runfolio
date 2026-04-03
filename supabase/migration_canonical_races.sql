-- Canonical race knowledge layer: app-owned UUIDs with many provider source rows.
-- Access: service role only for writes; optional read policies later for anon search.

create table if not exists canonical_races (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  organizer_name text,
  official_url text,
  registration_url text,
  logo_url text,
  hero_image_url text,
  country text,
  region text,
  city text,
  venue text,
  latitude double precision,
  longitude double precision,
  start_date text,
  end_date text,
  timezone text,
  distance_km double precision,
  elevation_gain_m double precision,
  race_type text,
  surface_type text,
  category_tags text[] not null default '{}',
  difficulty_score double precision,
  utmb_index_eligible boolean,
  utmb_category text,
  is_trail boolean,
  is_road boolean,
  is_ultra boolean,
  quality_score integer not null default 0,
  completeness_score integer not null default 0,
  quality_flags jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  curation_locked jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_races_status_chk check (status in ('draft', 'active', 'hidden', 'needs_review', 'duplicate_candidate'))
);

create index if not exists canonical_races_status_completeness_idx
  on canonical_races (status, completeness_score desc);

create index if not exists canonical_races_start_date_idx on canonical_races (start_date);
create index if not exists canonical_races_country_city_idx on canonical_races (country, city);

create table if not exists canonical_race_sources (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references canonical_races (id) on delete cascade,
  source text not null,
  source_race_id text not null,
  source_url text,
  last_fetched_at timestamptz,
  last_synced_at timestamptz,
  raw_payload jsonb,
  raw_hash text,
  mapped_fields jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_race_id)
);

create index if not exists canonical_race_sources_race_id_idx on canonical_race_sources (race_id);

alter table canonical_races enable row level security;
alter table canonical_race_sources enable row level security;

-- Intentionally no policies: anon/authenticated JWT cannot read/write; service role used from server.
