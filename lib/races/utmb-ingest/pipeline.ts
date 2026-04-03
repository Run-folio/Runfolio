import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAliasForMatch } from "@/lib/races/canonical/alias-normalize";
import { isRiskyAliasText } from "@/lib/races/canonical/series-backfill/grouping";
import type { CanonicalRaceAliasKind } from "@/lib/races/canonical/series-types";
import { importNormalizedRace, type CanonicalImportResult } from "@/lib/races/canonical/import-pipeline";
import { loadUtmbIngestRows } from "@/lib/races/utmb-ingest/load-rows";
import { defaultEditionYearRange, editionStartDateYmd } from "@/lib/races/utmb-ingest/edition-anchor";
import { inferUtmbIndexCategory } from "@/lib/races/utmb-ingest/utmb-category";
import { utmbRowToEditionNormalized } from "@/lib/races/utmb-ingest/to-normalized";
import type { UtmbIngestRow, UtmbIngestSummary } from "@/lib/races/utmb-ingest/types";
import { runfolioLog } from "@/lib/runfolio-log";

export type RunUtmbCanonicalIngestOptions = {
  dryRun: boolean;
  /** Inclusive calendar years for synthetic edition rows. */
  yearFrom: number;
  yearTo: number;
  skipUnchangedPayload?: boolean;
};

function seriesSlugForUtmbRow(row: UtmbIngestRow): string {
  return `utmb-${row.id.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`;
}

function summarizeImport(results: CanonicalImportResult[]): Pick<
  UtmbIngestSummary,
  "importCreated" | "importUpdated" | "importLinked" | "importNoop" | "importFailed"
> {
  let importCreated = 0;
  let importUpdated = 0;
  let importLinked = 0;
  let importNoop = 0;
  let importFailed = 0;
  for (const r of results) {
    if (!r.ok) {
      importFailed++;
      continue;
    }
    if (r.action === "created") importCreated++;
    else if (r.action === "updated") importUpdated++;
    else if (r.action === "linked") importLinked++;
    else if (r.action === "noop") importNoop++;
  }
  return { importCreated, importUpdated, importLinked, importNoop, importFailed };
}

async function aliasExistsForSeries(client: SupabaseClient, seriesId: string, aliasNormalized: string): Promise<boolean> {
  const { data, error } = await client
    .from("canonical_race_alias")
    .select("id")
    .eq("series_id", seriesId)
    .eq("alias_normalized", aliasNormalized)
    .maybeSingle();
  if (error) throw new Error(`canonical_race_alias lookup: ${error.message}`);
  return data != null;
}

/**
 * Curated short tokens (e.g. CCC) bypass generic alias heuristics when marked `abbrev` / `short`.
 */
function utmbAllowsShortAlias(kind: CanonicalRaceAliasKind, norm: string): boolean {
  if (kind !== "abbrev" && kind !== "short") return false;
  return /^[a-z0-9]{2,5}$/.test(norm);
}

async function ensureSeriesAlias(
  client: SupabaseClient,
  seriesId: string,
  text: string,
  kind: CanonicalRaceAliasKind,
  counters: { inserted: number; skippedRisky: number; skippedDup: number },
  dryRun: boolean
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const norm = normalizeAliasForMatch(trimmed);
  if (!norm) return;
  if (!utmbAllowsShortAlias(kind, norm) && isRiskyAliasText(trimmed, norm)) {
    counters.skippedRisky++;
    return;
  }
  if (dryRun) {
    counters.inserted++;
    return;
  }
  if (await aliasExistsForSeries(client, seriesId, norm)) {
    counters.skippedDup++;
    return;
  }
  const { error } = await client.from("canonical_race_alias").insert({
    series_id: seriesId,
    race_id: null,
    alias_text: trimmed,
    alias_normalized: norm,
    kind
  });
  if (error) {
    runfolioLog.warn("utmb.ingest.alias", error.message, { seriesId, norm });
    counters.skippedRisky++;
    return;
  }
  counters.inserted++;
}

function collectAliasPlan(row: UtmbIngestRow): { text: string; kind: CanonicalRaceAliasKind }[] {
  const out: { text: string; kind: CanonicalRaceAliasKind }[] = [];
  const seen = new Set<string>();

  const push = (text: string | null | undefined, kind: CanonicalRaceAliasKind) => {
    const t = text?.trim();
    if (!t) return;
    const n = normalizeAliasForMatch(t);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ text: t, kind });
  };

  push(row.name, "short");
  push(row.official_name, "official");
  for (const a of row.aliases ?? []) {
    const t = a.trim();
    const n = normalizeAliasForMatch(t);
    const kind: CanonicalRaceAliasKind = n.length <= 5 && /^[a-z0-9]+$/i.test(t.replace(/\s+/g, "")) ? "abbrev" : "variant";
    push(t, kind);
  }
  return out;
}

async function upsertUtmbSeries(
  client: SupabaseClient,
  row: UtmbIngestRow,
  slug: string,
  dryRun: boolean
): Promise<{ id: string; inserted: boolean }> {
  const utmbCat = inferUtmbIndexCategory(row.distance_km);
  const discoverPromote =
    row.match_tier === "flagship" || row.match_tier === "major" ? true : undefined;
  const utmbIngestBlock = {
    catalog_id: row.id,
    edition_date_quality: row.edition_date_quality ?? "month_relaxed",
    utmb_index_category: utmbCat,
    discover_promote_hint: discoverPromote ?? false,
    pipeline: "utmb_ws_canonical_v1"
  };

  if (dryRun) {
    return { id: `(dry-run:${slug})`, inserted: true };
  }

  const { data: existingRow, error: exErr } = await client
    .from("canonical_race_series")
    .select("id, metadata")
    .eq("slug", slug)
    .maybeSingle();
  if (exErr) throw new Error(`canonical_race_series lookup: ${exErr.message}`);

  const prevMeta =
    existingRow && typeof existingRow.metadata === "object" && existingRow.metadata !== null
      ? { ...(existingRow.metadata as Record<string, unknown>) }
      : {};
  const prevUtmb =
    prevMeta.utmb_ingest && typeof prevMeta.utmb_ingest === "object" && prevMeta.utmb_ingest !== null
      ? { ...(prevMeta.utmb_ingest as Record<string, unknown>) }
      : {};
  const metadata = {
    ...prevMeta,
    utmb_ingest: { ...prevUtmb, ...utmbIngestBlock }
  };

  const payload = {
    slug,
    name: row.official_name?.trim() || row.name,
    description: null as string | null,
    country: row.country ?? null,
    region: row.region_state ?? null,
    city: row.city ?? null,
    organizer_name: row.organizer_name ?? row.series_name ?? row.event_group ?? null,
    official_url: row.official_url?.trim() ?? null,
    default_surface_type: row.surface ?? "trail",
    metadata,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client.from("canonical_race_series").upsert(payload, { onConflict: "slug" }).select("id").single();
  if (error) throw new Error(`canonical_race_series upsert: ${error.message}`);
  const id = (data as { id: string }).id;
  return { id, inserted: !existingRow };
}

/**
 * Upsert UTMB series + aliases, then import dated edition rows (`utmb_ws` source) idempotently.
 */
export async function runUtmbCanonicalIngest(
  client: SupabaseClient,
  opts: RunUtmbCanonicalIngestOptions
): Promise<{ summary: UtmbIngestSummary; loadErrors: string[] }> {
  const { rows, validationErrors } = loadUtmbIngestRows();
  const summary: UtmbIngestSummary = {
    racesLoaded: rows.length,
    seriesUpserted: 0,
    seriesReused: 0,
    aliasesInserted: 0,
    aliasesSkippedRisky: 0,
    aliasesSkippedDuplicate: 0,
    editionsAttempted: 0,
    importCreated: 0,
    importUpdated: 0,
    importLinked: 0,
    importNoop: 0,
    importFailed: 0,
    skippedRaces: 0,
    skippedEditions: 0,
    validationErrors: [...validationErrors]
  };

  const importResults: CanonicalImportResult[] = [];

  for (const row of rows) {
    if (!row.id?.trim() || !row.name?.trim() || !row.distance_km || row.distance_km <= 0) {
      summary.skippedRaces++;
      summary.validationErrors.push(`Skip race: invalid id/name/distance for ${row.id ?? "?"}`);
      continue;
    }

    const slug = seriesSlugForUtmbRow(row);
    let seriesId: string;
    try {
      const up = await upsertUtmbSeries(client, row, slug, opts.dryRun);
      seriesId = up.id;
      if (!opts.dryRun) {
        if (up.inserted) summary.seriesUpserted++;
        else summary.seriesReused++;
      }
    } catch (e) {
      summary.skippedRaces++;
      summary.validationErrors.push(`${row.id}: series upsert failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const aliasCounters = { inserted: 0, skippedRisky: 0, skippedDup: 0 };
    for (const { text, kind } of collectAliasPlan(row)) {
      try {
        await ensureSeriesAlias(client, seriesId, text, kind, aliasCounters, opts.dryRun);
      } catch (e) {
        summary.validationErrors.push(`${row.id}: alias error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    summary.aliasesInserted += aliasCounters.inserted;
    summary.aliasesSkippedRisky += aliasCounters.skippedRisky;
    summary.aliasesSkippedDuplicate += aliasCounters.skippedDup;

    const years: number[] = [];
    for (let y = opts.yearFrom; y <= opts.yearTo; y++) {
      if (editionStartDateYmd(y, row)) years.push(y);
    }
    if (years.length === 0) {
      summary.skippedRaces++;
      summary.validationErrors.push(`${row.id}: no valid edition years in range`);
      continue;
    }

    for (const year of years) {
      const n = utmbRowToEditionNormalized(row, year, seriesId);
      if (!n) {
        summary.skippedEditions++;
        summary.validationErrors.push(`${row.id}:${year}: could not build edition date`);
        continue;
      }
      summary.editionsAttempted++;
      if (opts.dryRun) continue;

      const res = await importNormalizedRace(n, {
        skipUnchangedPayload: opts.skipUnchangedPayload,
        statusOnCreate: "active"
      });
      importResults.push(res);
      if (!res.ok) {
        summary.validationErrors.push(`${row.id}:${year}: import ${res.error}`);
      }
    }
  }

  const agg = summarizeImport(importResults);
  summary.importCreated = agg.importCreated;
  summary.importUpdated = agg.importUpdated;
  summary.importLinked = agg.importLinked;
  summary.importNoop = agg.importNoop;
  summary.importFailed = agg.importFailed;

  runfolioLog.info("utmb.ingest.summary", "complete", {
    racesLoaded: summary.racesLoaded,
    seriesUpserted: summary.seriesUpserted,
    seriesReused: summary.seriesReused,
    aliasesInserted: summary.aliasesInserted,
    editionsAttempted: summary.editionsAttempted,
    importCreated: summary.importCreated,
    importUpdated: summary.importUpdated,
    importLinked: summary.importLinked,
    importNoop: summary.importNoop,
    importFailed: summary.importFailed,
    skippedRaces: summary.skippedRaces,
    skippedEditions: summary.skippedEditions,
    validationErrorCount: summary.validationErrors.length
  });
  return { summary, loadErrors: validationErrors };
}

export function defaultUtmbIngestOptions(referenceYear = new Date().getUTCFullYear()): RunUtmbCanonicalIngestOptions {
  const { from, to } = defaultEditionYearRange(referenceYear);
  return { dryRun: true, yearFrom: from, yearTo: to, skipUnchangedPayload: true };
}
