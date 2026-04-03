-- Series + edition model for canonical catalog matching.
-- Edition = existing `canonical_races` row (dated instance). Series = recurring event identity.
-- Backfill: optional — leave series_id NULL on existing rows until curated; matcher degrades to flat window behavior.

-- Optional: enable for GIN trgm index below (Supabase usually allows).
create extension if not exists pg_trgm;

create table if not exists canonical_race_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  country text,
  region text,
  city text,
  organizer_name text,
  official_url text,
  default_surface_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canonical_race_series_slug_idx on canonical_race_series (slug);
create index if not exists canonical_race_series_country_city_idx on canonical_race_series (country, city);

alter table canonical_races
  add column if not exists series_id uuid references canonical_race_series (id) on delete set null;

create index if not exists canonical_races_series_start_idx
  on canonical_races (series_id, start_date)
  where series_id is not null;

-- Exactly one of series_id or race_id must be set (series-level vs edition-level alias).
create table if not exists canonical_race_alias (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references canonical_race_series (id) on delete cascade,
  race_id uuid references canonical_races (id) on delete cascade,
  alias_text text not null,
  alias_normalized text not null,
  kind text not null default 'variant',
  constraint canonical_race_alias_target_chk check (
    (series_id is not null and race_id is null) or (series_id is null and race_id is not null)
  ),
  constraint canonical_race_alias_kind_chk check (
    kind in ('official', 'short', 'abbrev', 'sponsor', 'alt_spelling', 'variant')
  )
);

create unique index if not exists canonical_race_alias_series_norm_uidx
  on canonical_race_alias (series_id, alias_normalized)
  where series_id is not null;

create unique index if not exists canonical_race_alias_race_norm_uidx
  on canonical_race_alias (race_id, alias_normalized)
  where race_id is not null;

create index if not exists canonical_race_alias_norm_trgm_idx
  on canonical_race_alias using gin (alias_normalized gin_trgm_ops);

alter table canonical_race_series enable row level security;
alter table canonical_race_alias enable row level security;

-- No policies: same as canonical_races — service role for writes.
