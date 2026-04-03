import { readFileSync } from "node:fs";
import { UTMB_WORLD_SERIES_RECORDS } from "@/lib/catalog/utmb-world-series";
import type { UtmbIngestJsonRow, UtmbIngestRow } from "@/lib/races/utmb-ingest/types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function coerceRow(raw: unknown): UtmbIngestRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const distance_km = typeof raw.distance_km === "number" ? raw.distance_km : Number(raw.distance_km);
  if (!id || !name || !Number.isFinite(distance_km) || distance_km <= 0) {
    return null;
  }
  const row = raw as UtmbIngestJsonRow;
  return {
    id,
    name,
    official_name: row.official_name,
    location: typeof row.location === "string" ? row.location : `${row.city ?? ""}, ${row.country ?? ""}`.replace(/^,\s*|,\s*$/g, "").trim() || name,
    city: row.city ?? null,
    region_state: row.region_state ?? null,
    country: row.country ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    distance_km,
    distance_variants_km: row.distance_variants_km,
    elevation_m_est: row.elevation_m_est ?? null,
    event_type: row.event_type as UtmbIngestRow["event_type"],
    surface: row.surface ?? "trail",
    group: "utmb",
    series_name: row.series_name ?? null,
    event_group: row.event_group ?? "UTMB World Series",
    typical_months: row.typical_months,
    edition_date_quality: row.edition_date_quality,
    edition_date_anchor_ymd: row.edition_date_anchor_ymd,
    tags: row.tags,
    aliases: row.aliases,
    organizer_name: row.organizer_name ?? null,
    official_url: row.official_url ?? null,
    source: "utmb_ws",
    match_tier: row.match_tier
  };
}

/**
 * Load UTMB ingest rows: `UTMB_INGEST_JSON_PATH` (JSON array) when set, else bundled `UTMB_WORLD_SERIES_RECORDS`.
 */
export function loadUtmbIngestRows(): { rows: UtmbIngestRow[]; validationErrors: string[] } {
  const path = process.env.UTMB_INGEST_JSON_PATH?.trim();
  if (path) {
    const validationErrors: string[] = [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      validationErrors.push(`Failed to read or parse JSON at ${path}: ${e instanceof Error ? e.message : String(e)}`);
      return { rows: [], validationErrors };
    }
    if (!Array.isArray(parsed)) {
      validationErrors.push("UTMB ingest JSON must be a top-level array");
      return { rows: [], validationErrors };
    }
    const rows: UtmbIngestRow[] = [];
    parsed.forEach((item, idx) => {
      const r = coerceRow(item);
      if (r) rows.push(r);
      else validationErrors.push(`Index ${idx}: missing id, name, or valid distance_km`);
    });
    return { rows, validationErrors };
  }

  return { rows: [...UTMB_WORLD_SERIES_RECORDS], validationErrors: [] };
}
