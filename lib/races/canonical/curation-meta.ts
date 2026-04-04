/**
 * Stored in `canonical_races.curation_meta` (jsonb). Edited via internal race-ops only.
 * Does not replace `curation_locked` — locks block automated merges; meta is audit / QA signals.
 */
export type CanonicalCurationMeta = {
  /** Field keys considered human-verified (camelCase, aligned with merge lock keys). */
  verifiedFields?: string[];
  /** Auto-enrichment fields flagged as low trust / needs review. */
  weakEnrichmentFields?: string[];
  lastOpsEditAt?: string | null;
  notes?: string | null;
};

export function parseCanonicalCurationMeta(raw: unknown): CanonicalCurationMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const vf = o.verifiedFields;
  const wf = o.weakEnrichmentFields;
  return {
    verifiedFields: Array.isArray(vf) ? vf.filter((x): x is string => typeof x === "string") : undefined,
    weakEnrichmentFields: Array.isArray(wf) ? wf.filter((x): x is string => typeof x === "string") : undefined,
    lastOpsEditAt: typeof o.lastOpsEditAt === "string" ? o.lastOpsEditAt : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined
  };
}

export function serializeCanonicalCurationMeta(m: CanonicalCurationMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.verifiedFields?.length) out.verifiedFields = m.verifiedFields;
  if (m.weakEnrichmentFields?.length) out.weakEnrichmentFields = m.weakEnrichmentFields;
  if (m.lastOpsEditAt) out.lastOpsEditAt = m.lastOpsEditAt;
  if (m.notes?.trim()) out.notes = m.notes.trim();
  return out;
}

/** Lock keys supported by merge + enrichment (for UI checkboxes). */
export const CANONICAL_CURATION_LOCK_KEYS = [
  "name",
  "description",
  "longDescription",
  "organizerName",
  "officialUrl",
  "registrationUrl",
  "logoUrl",
  "heroImageUrl",
  "fallbackImageUrl",
  "country",
  "region",
  "city",
  "venue",
  "latitude",
  "longitude",
  "startDate",
  "endDate",
  "timezone",
  "distanceKm",
  "distanceOptionsKm",
  "elevationGainM",
  "raceType",
  "surfaceType",
  "categoryTags",
  "seriesId",
  "difficultyScore",
  "utmbIndexEligible",
  "utmbCategory",
  "isTrail",
  "isRoad",
  "isUltra"
] as const;

export type CanonicalCurationLockKey = (typeof CANONICAL_CURATION_LOCK_KEYS)[number];
