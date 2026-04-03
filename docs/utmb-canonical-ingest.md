# UTMB canonical ingest

Curated **UTMB World Series**–style races are loaded into the **canonical** layer only (`canonical_race_series`, `canonical_races`, `canonical_race_alias`). Discover / Find catalog code is unchanged; optional `discover_promote_hint` is stored on the series row metadata for future use.

## Mapping

| Layer | Rule |
|--------|------|
| **Series** | One `canonical_race_series` per catalog race, stable slug `utmb-{catalog_id}` (e.g. `utmb-disc-ccc`). Display name prefers `official_name`, else `name`. Geography and organizer fields come from the catalog row. |
| **Editions** | One `canonical_races` row per `(catalog_id, calendar year)` in the configured year range. `canonical_race_sources` uses `source = utmb_ws` and `source_race_id = "{id}:{year}"` for idempotency. Each edition sets `series_id` to the parent series. |
| **Dates** | If `edition_date_anchor_ymd` is set, its month/day are applied to each target year. Otherwise the first `typical_months` entry is used with a day derived from the series id (reduces same-day collisions). Tags include `edition_date_quality:{quality}` from the row. |
| **Aliases** | Series-level aliases: `name` (short), `official_name` (official), explicit `aliases` (abbrev vs variant heuristics). Short codes (e.g. CCC) are allowed when marked `abbrev` / `short`; generic risky strings still use the same guards as series backfill. |

## Fields captured

From each row (bundled or JSON): name, official name, location / city / region / country, coordinates, primary distance (and variants in `rawPayload`), elevation estimate, event type, surface, typical months, edition date quality / anchor, tags, organizer/series labels, optional `official_url`, optional `match_tier` (feeds `discover_promote_hint` in metadata for flagship/major only).

Normalized editions also set: `startDate`, `distanceKm`, `elevationGainM`, `utmbCategory` (heuristic 20K / 50K / 100K / 100M from distance), trail/ultra flags, and `categoryTags` including `utmb_ws` and `utmb_edition_anchor`.

## Why this helps matching

Canonical matcher windows require **non-null `start_date`** and **`active`** status. This pipeline creates **dated, active** edition rows with coordinates and distance, linked to a **series** with **curated aliases**—so time-window candidate loading and name/alias matching can resolve UTMB-titled activities without expanding the discover browse catalog.

## Running

```bash
# Dry-run (default): no writes
npm run utmb-canonical-ingest

# Apply (needs service role + Supabase URL)
npm run utmb-canonical-ingest -- --apply

# Optional: extra rows from JSON (array of objects with id, name, distance_km, …)
UTMB_INGEST_JSON_PATH=./data/utmb-extra.json npm run utmb-canonical-ingest -- --apply

# Year span (default: refYear−1 … refYear+2)
npm run utmb-canonical-ingest -- --apply --year-from 2023 --year-to 2027
```

Re-runs update series metadata (merged), skip duplicate aliases, and use `canonical_race_sources.raw_hash` for **noop** when payloads are unchanged.

## Scraping / external data

There is no live fetch in-repo. Add rows to `UTMB_INGEST_JSON_PATH` or extend `lib/catalog/utmb-world-series.ts`; a future scraper should emit the same JSON shape as `UtmbIngestJsonRow` in `lib/races/utmb-ingest/types.ts`.
