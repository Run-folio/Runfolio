# Canonical race series backfill

Optional workflow to create `canonical_race_series` rows, set `canonical_races.series_id`, and seed `canonical_race_alias` from existing edition data **without** breaking the app when tables are empty or `series_id` stays null.

## Prerequisites

- SQL migration applied: `supabase/migration_canonical_race_series.sql`
- Environment (same as server ingest):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Grouping rules (conservative)

Editions considered: `canonical_races` where `series_id IS NULL` and `status IN ('active','draft','needs_review')`.

1. **Grouping key** = normalized name **stem** (Unicode-fold, lowercase, punctuation stripped, **4-digit years removed**) + **normalized city** + **normalized country**.  
   - Rows with **no city and no country** are excluded from automatic grouping.
2. **Stem strength**: stem must be “non-trivial” (e.g. at least two meaningful tokens or length ≥ 12) to avoid buckets like `race` or `10k`.
3. **Single stem per bucket**: all editions in a bucket must share the **same** stem; otherwise the bucket is **skipped** as ambiguous.
4. **Recurring signal**: at least **`minDistinctYears`** distinct `start_date` years (default **2**).
5. **Minimum editions**: at least **`minEditions`** rows in the bucket (default **2**).
6. **Distance coherence**: all non-null `distance_km` values must lie within a relative spread (default **12%**), matching dedupe-style thinking.

## `series_id` assignment

- **Only** editions in an accepted group are updated.
- Updates use `.is('series_id', null)` so re-runs do not fight manual curations that already set `series_id`.
- **Dry-run** logs intended links but does not call `UPDATE`.

## Alias seeding (conservative)

- **Series-level** (`series_id` set): edition titles or slug-derived phrases that share the **same stem** as the series and pass **non-generic** heuristics (`kind` usually `variant`).
- **Edition-level** (`race_id` set): titles whose stem **differs** from the series stem (e.g. distinct distance branding) → `kind` `official` for that edition only.
- Skips short / generic-only aliases; skips DB duplicates (unique on normalized target).

Series rows created by the tool set `metadata.backfill_run_id`, `metadata.grouping_key`, `metadata.backfill_version: 1` for rollback tagging.

## Commands

Dry-run (default — **no writes**):

```bash
npm run canonical-series-backfill
# or
npx tsx scripts/canonical-series-backfill.ts
```

Apply with a stable run id (for rollback / audit):

```bash
npx tsx scripts/canonical-series-backfill.ts --apply --run-id batch-2026-04-02-a
```

Batch constraints:

```bash
npx tsx scripts/canonical-series-backfill.ts --apply --run-id batch-a --max-new-series 25 --max-groups 50
```

Full JSON report:

```bash
npx tsx scripts/canonical-series-backfill.ts --json > backfill-report.json
```

Verbose one-json-per-line logs:

```bash
npx tsx scripts/canonical-series-backfill.ts --verbose
```

Tunables:

- `--min-editions`
- `--min-distinct-years`
- `--max-distance-spread` (ratio, default `0.12`)

## Rollback (data)

**Aliases** created under a run (series metadata tag):

```sql
-- Preview
select id, slug, name, metadata
from canonical_race_series
where metadata->>'backfill_run_id' = 'YOUR_RUN_ID';

-- Delete aliases for those series
delete from canonical_race_alias
where series_id in (
  select id from canonical_race_series where metadata->>'backfill_run_id' = 'YOUR_RUN_ID'
);

-- Clear edition links (only if you are sure)
update canonical_races
set series_id = null, updated_at = now()
where series_id in (
  select id from canonical_race_series where metadata->>'backfill_run_id' = 'YOUR_RUN_ID'
);

-- Remove series rows from that run
delete from canonical_race_series
where metadata->>'backfill_run_id' = 'YOUR_RUN_ID';
```

Edition-level aliases (`race_id` set) are not tagged by run in metadata; rollback those selectively using the backfill JSON log or by `alias_text` if needed.

## Safety

- Matcher and discover flows tolerate **empty** series tables and **null** `series_id`.
- The tool never sets `series_id` on `hidden` or `duplicate_candidate` rows (they are excluded from grouping).
- Default CLI mode is **dry-run**; **`--apply`** is required for writes.

## Code entry points

- `lib/races/canonical/series-backfill/workflow.ts` — `runSeriesBackfillWorkflow`
- `scripts/canonical-series-backfill.ts` — CLI
