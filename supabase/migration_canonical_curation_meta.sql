-- Lightweight ops metadata for canonical editions (internal curation UI; not user-facing CMS).

alter table canonical_races
  add column if not exists curation_meta jsonb not null default '{}'::jsonb;

comment on column canonical_races.curation_meta is
  'Internal ops: verified field keys, weak enrichment flags, last manual edit timestamp, notes (see lib/races/canonical/curation-meta.ts).';
