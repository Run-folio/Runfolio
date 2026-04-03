import type { StravaSummaryActivityJson } from "@/lib/strava-api";
import { hasStrongCatalogMatchForStravaSummary } from "@/lib/known-race-match";

/** Primary ingest types: Run, Trail Run / TrailRun, Race. */
const HIGH_SIGNAL_TYPES = new Set(["Run", "Trail Run", "TrailRun", "Race"]);

/**
 * Incremental / general race-like titles (30km bar + manual pool).
 * Historical backfill uses `BACKFILL_SUB40_RACE_TITLE_RE` (stricter + expanded).
 */
const RACE_NAME_RE_INCREMENTAL =
  /\b(ultra|marathon|half\s*marathon|50k|50\s*k|100k|100\s*k|100\s*miler|miler|trail\s+race|\brace\b|utmb|ccc|occ|escape|revel|jfk|western\s*states|leadville|hardrock|badwater|marathon\s+de)/i;

/**
 * Obvious structured events under 40km for **historical backfill only** (marathon family, common ultras, classic tiers).
 */
const BACKFILL_SUB40_RACE_TITLE_RE =
  /\b(half\s*marathon|full\s*marathon|\bmarathon\b|ultra(\s*marathon)?|50k|50\s*k\b|100k|100\s*k|100\s*miler|50\s*miler|\bmiler\b|trail\s+race|\brace\b|10k|10\s*k\b|15k|20k|21k|21\.1|10\s*miler|utmb|ccc|occ|western\s*states|leadville|hardrock|badwater|escape|revel|jfk)/i;

function raceLikeNameIncremental(name: string): boolean {
  return RACE_NAME_RE_INCREMENTAL.test(name);
}

function raceLikeNameBackfillSub40(name: string): boolean {
  return BACKFILL_SUB40_RACE_TITLE_RE.test(name);
}

function distKm(raw: StravaSummaryActivityJson): number {
  return Math.round((raw.distance / 1000) * 100) / 100;
}

function isHighSignalSport(raw: StravaSummaryActivityJson): boolean {
  const s = (raw.sport_type ?? "").trim();
  const t = (raw.type ?? "").trim();
  return HIGH_SIGNAL_TYPES.has(s) || HIGH_SIGNAL_TYPES.has(t);
}

function isVirtualRun(raw: StravaSummaryActivityJson): boolean {
  const s = (raw.sport_type ?? "").trim();
  const t = (raw.type ?? "").trim();
  return s === "VirtualRun" || t === "VirtualRun";
}

const MIN_MANUAL_KM = 10;
const MIN_HIGH_KM_INCREMENTAL = 30;
const MIN_NAMED_EVENT_KM_INCREMENTAL = 15;

/** Historical backfill: default bar for Run / Trail Run / Race (VirtualRun uses same numeric gate). */
export const HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM = 40;
const MIN_HIGH_KM_BACKFILL = HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM;
/** Minimum distance for title-based sub-40 exception (half marathon, 10k in name, etc.). */
const MIN_SUB40_TITLE_EXCEPTION_KM = 15;
/** Minimum distance for catalog-based sub-40 exception (strong line-up with verified race). */
const MIN_SUB40_CATALOG_EXCEPTION_KM = 10;

export type StravaImportMode = "incremental" | "historical_backfill";

export type StravaImportTier = "skip" | "high_signal" | "manual_pool";

/**
 * Incremental sync: ≥30 km run-family high_signal; 10–29 km → manual_pool when run/virtual and named; else skip.
 */
function classifyStravaSummaryImportIncremental(raw: StravaSummaryActivityJson): StravaImportTier {
  const km = distKm(raw);
  if (!Number.isFinite(km) || km < MIN_MANUAL_KM) return "skip";

  const highSport = isHighSignalSport(raw);
  const virtualRun = isVirtualRun(raw);
  if (!highSport && !virtualRun) return "skip";

  if (km >= MIN_HIGH_KM_INCREMENTAL) return "high_signal";

  if (raceLikeNameIncremental(raw.name) && km >= MIN_NAMED_EVENT_KM_INCREMENTAL) return "high_signal";

  return "manual_pool";
}

/**
 * Historical backfill: full-history walk but only **high-signal** rows are persisted (no manual_pool).
 * Default ≥40km (see `HISTORICAL_BACKFILL_MIN_HIGH_SIGNAL_KM`) for run types, or sub-threshold with strong title / catalog match.
 */
function classifyStravaSummaryImportHistoricalBackfill(raw: StravaSummaryActivityJson): StravaImportTier {
  const km = distKm(raw);
  if (!Number.isFinite(km) || km < MIN_MANUAL_KM) return "skip";

  const highSport = isHighSignalSport(raw);
  const virtualRun = isVirtualRun(raw);
  if (!highSport && !virtualRun) return "skip";

  if (km >= MIN_HIGH_KM_BACKFILL) return "high_signal";

  if (km >= MIN_SUB40_TITLE_EXCEPTION_KM && raceLikeNameBackfillSub40(raw.name)) return "high_signal";

  if (km >= MIN_SUB40_CATALOG_EXCEPTION_KM && hasStrongCatalogMatchForStravaSummary(raw)) return "high_signal";

  return "skip";
}

/**
 * Classifies list-endpoint activities for persistence.
 * Use `historical_backfill` only in the bounded backfill path; incremental stays broader for new activities + manual pool.
 */
export function classifyStravaSummaryImport(
  raw: StravaSummaryActivityJson,
  mode: StravaImportMode = "incremental"
): StravaImportTier {
  return mode === "historical_backfill"
    ? classifyStravaSummaryImportHistoricalBackfill(raw)
    : classifyStravaSummaryImportIncremental(raw);
}

export function filterSummariesForPersist(
  summaries: StravaSummaryActivityJson[],
  mode: StravaImportMode = "incremental"
): Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }> {
  const out: Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }> = [];
  for (const raw of summaries) {
    const tier = classifyStravaSummaryImport(raw, mode);
    if (tier === "skip") continue;
    out.push({ raw, manualLinkOnly: tier === "manual_pool" });
  }
  return out;
}
