-- Global race catalog rows ingested from external providers (separate from per-user `races` portfolio table).
-- Access: server-side only via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Do not expose service key to the client.

create table if not exists race_catalog_imports (
  id uuid primary key default gen_random_uuid(),
  internal_id text not null unique,
  source text not null,
  source_race_id text not null,
  normalized jsonb not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_race_id)
);

create index if not exists race_catalog_imports_source_idx on race_catalog_imports (source);
create index if not exists race_catalog_imports_name_idx on race_catalog_imports ((normalized->>'name'));

alter table race_catalog_imports enable row level security;

-- Intentionally no policies: anon/authenticated JWT cannot read/write; service role bypasses RLS for backend ingestion.
