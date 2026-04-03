/**
 * Two-phase canonical candidate loading: plausible series → editions in date window, then sparse fallbacks.
 * When `series_id` / alias tables are empty (pre-backfill), behavior matches legacy flat window loading.
 */

import type { CanonicalRace } from "@/lib/races/canonical/types";
import { normalizeRaceName } from "@/lib/races/dedupe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";
import { loadCanonicalRacesByNameToken, loadCanonicalRacesInDateWindow } from "@/lib/strava-canonical-match/load-candidates";
import type { ActivityForCanonicalMatch } from "@/lib/strava-canonical-match/score-activity-canonical";

export type CanonicalMatchCandidateTrace = {
  phase: "series_then_editions" | "legacy_flat";
  seriesIdsFromAliases: string[];
  seriesIdsFromSeriesName: string[];
  allSeriesIds: string[];
  editionCountAfterDateWindow: number;
  editionCountAfterSeriesFilter: number;
  sparseSeriesFallback: boolean;
  nameTokenSupplement: boolean;
};

function distinctTokensForSeriesLookup(activityTitle: string): string[] {
  const norm = normalizeRaceName(activityTitle);
  const parts = norm.split(/\s+/).filter((w) => w.length >= 4);
  return [...new Set(parts)].slice(0, 8);
}

export type SeriesResolutionHints = {
  seriesIds: string[];
  fromAliasHits: string[];
  fromSeriesNameHits: string[];
};

/**
 * Resolve series UUIDs: alias table ILIKE on title tokens + series.name overlap.
 * If tables are missing (migration not applied), returns empty lists (legacy matcher path).
 */
export async function resolveSeriesHintsForActivity(activityTitle: string): Promise<SeriesResolutionHints> {
  const empty = (): SeriesResolutionHints => ({
    seriesIds: [],
    fromAliasHits: [],
    fromSeriesNameHits: []
  });
  const supabase = createServiceRoleClient();
  if (!supabase) return empty();

  const fromAlias = new Set<string>();
  const fromName = new Set<string>();
  const tokens = distinctTokensForSeriesLookup(activityTitle);

  if (tokens.length > 0) {
    const orParts = tokens.map((t) => `alias_normalized.ilike.%${t}%`);
    const { data, error } = await supabase
      .from("canonical_race_alias")
      .select("series_id")
      .not("series_id", "is", null)
      .or(orParts.join(","));
    if (error) {
      if (!/relation|does not exist/i.test(error.message)) {
        runfolioLog.warn("canonicalMatch.seriesAlias", error.message);
      }
    } else {
      for (const row of data ?? []) {
        const sid = (row as { series_id?: string }).series_id;
        if (sid) fromAlias.add(sid);
      }
    }
  }

  const needle = normalizeRaceName(activityTitle).slice(0, 40);
  if (needle.length >= 8) {
    const { data: srows, error: sErr } = await supabase
      .from("canonical_race_series")
      .select("id")
      .ilike("name", `%${needle}%`);
    if (sErr) {
      if (!/relation|does not exist/i.test(sErr.message)) {
        runfolioLog.warn("canonicalMatch.seriesTable", sErr.message);
      }
    } else {
      for (const row of srows ?? []) {
        const id = (row as { id: string }).id;
        if (id) fromName.add(id);
      }
    }
  }

  const merged = new Set<string>([...fromAlias, ...fromName]);
  return {
    seriesIds: [...merged],
    fromAliasHits: [...fromAlias],
    fromSeriesNameHits: [...fromName]
  };
}

function filterEditionsBySeriesIds(races: CanonicalRace[], seriesIds: Set<string>): CanonicalRace[] {
  return races.filter((r) => {
    if (!r.seriesId) return true;
    return seriesIds.has(r.seriesId);
  });
}

/**
 * Load edition rows for Strava ↔ canonical matching (before per-row plausibility + scoring).
 */
export async function loadCanonicalMatchCandidateRaces(
  act: ActivityForCanonicalMatch
): Promise<{ races: CanonicalRace[]; trace: CanonicalMatchCandidateTrace }> {
  const trace: CanonicalMatchCandidateTrace = {
    phase: "series_then_editions",
    seriesIdsFromAliases: [],
    seriesIdsFromSeriesName: [],
    allSeriesIds: [],
    editionCountAfterDateWindow: 0,
    editionCountAfterSeriesFilter: 0,
    sparseSeriesFallback: false,
    nameTokenSupplement: false
  };

  let races = await loadCanonicalRacesInDateWindow(act.startDateYmd, 10);
  trace.editionCountAfterDateWindow = races.length;

  const hints = await resolveSeriesHintsForActivity(act.name);
  trace.seriesIdsFromAliases = hints.fromAliasHits;
  trace.seriesIdsFromSeriesName = hints.fromSeriesNameHits;
  trace.allSeriesIds = hints.seriesIds;

  const seriesSet = new Set(hints.seriesIds);
  if (seriesSet.size > 0) {
    const narrowed = filterEditionsBySeriesIds(races, seriesSet);
    trace.editionCountAfterSeriesFilter = narrowed.length;
    if (narrowed.length > 0) {
      races = narrowed;
    } else {
      trace.sparseSeriesFallback = true;
      trace.editionCountAfterSeriesFilter = races.length;
    }
  } else {
    trace.phase = "legacy_flat";
    trace.editionCountAfterSeriesFilter = races.length;
  }

  if (races.length < 4) {
    const token = act.name.split(/\s+/).find((w) => w.length > 5) ?? act.name.slice(0, 14);
    const extra = await loadCanonicalRacesByNameToken(token, {
      centerYmd: act.startDateYmd,
      editionDayRadius: 520
    });
    if (seriesSet.size > 0 && !trace.sparseSeriesFallback) {
      const narrowedExtra = filterEditionsBySeriesIds(extra, seriesSet);
      if (narrowedExtra.length > 0) {
        trace.nameTokenSupplement = true;
        const seen = new Set(races.map((r) => r.id));
        for (const r of narrowedExtra) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            races.push(r);
          }
        }
      } else if (extra.length > 0) {
        trace.sparseSeriesFallback = true;
        trace.nameTokenSupplement = true;
        const seen = new Set(races.map((r) => r.id));
        for (const r of extra) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            races.push(r);
          }
        }
      }
    } else {
      trace.nameTokenSupplement = extra.length > 0;
      const seen = new Set(races.map((r) => r.id));
      for (const r of extra) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          races.push(r);
        }
      }
    }
  }

  return { races, trace };
}
