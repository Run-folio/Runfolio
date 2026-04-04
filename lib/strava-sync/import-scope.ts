import type { StravaSummaryActivityJson } from "@/lib/strava-api";
import { hasStrongCatalogMatchForStravaSummary } from "@/lib/known-race-match";
import { runfolioLog } from "@/lib/runfolio-log";

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

/** Set `STRAVA_BACKFILL_RELAXED_DEBUG=1` to accept any run/VirtualRun ≥30 km without title or catalog (local debugging only). */
export function isStravaBackfillRelaxedDebug(): boolean {
  return process.env.STRAVA_BACKFILL_RELAXED_DEBUG === "1";
}

/** Per-activity JSON logs + batch summary when `NODE_ENV === "development"` or `STRAVA_BACKFILL_IMPORT_DEBUG=1`. */
export function shouldLogStravaBackfillImportEval(): boolean {
  return process.env.NODE_ENV === "development" || process.env.STRAVA_BACKFILL_IMPORT_DEBUG === "1";
}

export type HistoricalBackfillImportEval = {
  activity_id: number;
  name: string;
  distance_km: number;
  sport_type: string;
  activity_type: string;
  start_date: string | null;
  relaxed_debug: boolean;
  passes_minimum_distance: boolean;
  passes_type_gate: boolean;
  passes_distance_threshold: boolean;
  passes_title_signal: boolean;
  catalog_match_found: boolean;
  final_decision: "accepted" | "rejected";
  rejection_reasons: string[];
};

/**
 * Explains historical backfill persist gate for one list activity (mirrors {@link classifyStravaSummaryImportHistoricalBackfill}).
 */
export function evaluateHistoricalBackfillImport(raw: StravaSummaryActivityJson): HistoricalBackfillImportEval {
  const relaxed = isStravaBackfillRelaxedDebug();
  const km = distKm(raw);
  const name = raw.name ?? "";
  const highSport = isHighSignalSport(raw);
  const virtualRun = isVirtualRun(raw);
  const sportType = (raw.sport_type ?? "").trim();
  const activityType = (raw.type ?? "").trim();

  const passes_minimum_distance = Number.isFinite(km) && km >= MIN_MANUAL_KM;
  const passes_type_gate = highSport || virtualRun;
  const passes_distance_threshold = relaxed ? km >= 30 : km >= MIN_HIGH_KM_BACKFILL;
  const passes_title_signal = km >= MIN_SUB40_TITLE_EXCEPTION_KM && raceLikeNameBackfillSub40(name);

  const shouldComputeCatalogMatch =
    !relaxed &&
    passes_type_gate &&
    km >= MIN_SUB40_CATALOG_EXCEPTION_KM &&
    km < MIN_HIGH_KM_BACKFILL;
  const catalog_match_found = shouldComputeCatalogMatch ? hasStrongCatalogMatchForStravaSummary(raw) : false;

  const rejection_reasons: string[] = [];
  let final_decision: "accepted" | "rejected" = "rejected";

  if (!passes_minimum_distance) {
    rejection_reasons.push("distance_below_minimum");
  } else if (!passes_type_gate) {
    rejection_reasons.push("type_not_supported");
  } else if (relaxed && km >= 30) {
    final_decision = "accepted";
  } else if (km >= MIN_HIGH_KM_BACKFILL) {
    final_decision = "accepted";
  } else if (passes_title_signal) {
    final_decision = "accepted";
  } else if (km >= MIN_SUB40_CATALOG_EXCEPTION_KM && catalog_match_found) {
    final_decision = "accepted";
  } else {
    if (relaxed) {
      rejection_reasons.push("distance_below_relaxed_threshold");
    } else {
      if (km < MIN_HIGH_KM_BACKFILL) rejection_reasons.push("distance_below_threshold");
      if (!passes_title_signal) rejection_reasons.push("no_title_signal");
      if (!catalog_match_found) rejection_reasons.push("no_catalog_match");
    }
  }

  return {
    activity_id: raw.id,
    name,
    distance_km: km,
    sport_type: sportType,
    activity_type: activityType,
    start_date: raw.start_date ?? null,
    relaxed_debug: relaxed,
    passes_minimum_distance,
    passes_type_gate,
    passes_distance_threshold,
    passes_title_signal,
    catalog_match_found,
    final_decision,
    rejection_reasons
  };
}

export function partitionSummariesForHistoricalBackfill(summaries: StravaSummaryActivityJson[]): {
  items: Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }>;
  evals: HistoricalBackfillImportEval[];
} {
  const items: Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }> = [];
  const evals: HistoricalBackfillImportEval[] = [];
  for (const raw of summaries) {
    const e = evaluateHistoricalBackfillImport(raw);
    evals.push(e);
    if (e.final_decision === "accepted") {
      items.push({ raw, manualLinkOnly: false });
    }
  }
  return { items, evals };
}

/**
 * Development / explicit-debug logging for backfill import gates (one JSON line per activity + summary).
 */
export function logHistoricalBackfillImportEvalIfEnabled(userId: string, evals: HistoricalBackfillImportEval[]): void {
  if (!shouldLogStravaBackfillImportEval() || evals.length === 0) return;

  let passedDistanceThreshold = 0;
  let passedTitleSignal = 0;
  let catalogMatchFound = 0;
  let accepted = 0;

  for (const e of evals) {
    if (e.passes_distance_threshold) passedDistanceThreshold++;
    if (e.passes_title_signal) passedTitleSignal++;
    if (e.catalog_match_found) catalogMatchFound++;
    if (e.final_decision === "accepted") accepted++;

    const payload = {
      activity_id: e.activity_id,
      name: e.name,
      distance_km: e.distance_km,
      sport_type: e.sport_type,
      activity_type: e.activity_type,
      start_date: e.start_date,
      passes_distance_threshold: e.passes_distance_threshold,
      passes_title_signal: e.passes_title_signal,
      catalog_match_found: e.catalog_match_found,
      final_decision: e.final_decision,
      rejection_reasons: e.rejection_reasons,
      relaxed_debug: e.relaxed_debug
    };
    console.info(`[Runfolio:debug][strava.backfill.import_eval] ${JSON.stringify(payload)}`);
  }

  runfolioLog.info("strava.backfill", "import_eval_summary", {
    userId,
    processed: evals.length,
    passedDistanceThreshold,
    passedTitleSignal,
    catalogMatchFound,
    accepted,
    rejected: evals.length - accepted,
    relaxedDebug: isStravaBackfillRelaxedDebug()
  });
}

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
 * With `STRAVA_BACKFILL_RELAXED_DEBUG=1`, any run/VirtualRun ≥30 km is accepted (no title/catalog required).
 */
function classifyStravaSummaryImportHistoricalBackfill(raw: StravaSummaryActivityJson): StravaImportTier {
  return evaluateHistoricalBackfillImport(raw).final_decision === "accepted" ? "high_signal" : "skip";
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
  if (mode === "historical_backfill") {
    return partitionSummariesForHistoricalBackfill(summaries).items;
  }
  const out: Array<{ raw: StravaSummaryActivityJson; manualLinkOnly: boolean }> = [];
  for (const raw of summaries) {
    const tier = classifyStravaSummaryImport(raw, mode);
    if (tier === "skip") continue;
    out.push({ raw, manualLinkOnly: tier === "manual_pool" });
  }
  return out;
}
