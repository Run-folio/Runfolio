import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRaceName } from "@/lib/races/dedupe";
import { normalizeAliasForMatch } from "@/lib/races/canonical/alias-normalize";
import {
  distancesCoherent,
  editionNameStem,
  isRiskyAliasText,
  isStemStrongEnough,
  makeGroupingKey,
  normalizedGeoCity,
  normalizedGeoCountry,
  startDateYear,
  stripYearTokensFromNormalized,
  type CanonRaceEditionRow
} from "@/lib/races/canonical/series-backfill/grouping";
import type { SeriesBackfillLogEntry, SeriesBackfillResult, SeriesBackfillSummary } from "./types";

const ELIGIBLE_STATUSES = new Set(["active", "draft", "needs_review"]);

export type RunSeriesBackfillOptions = {
  dryRun: boolean;
  minEditions: number;
  minDistinctYears: number;
  maxDistanceSpreadRatio: number;
  backfillRunId: string;
  maxNewSeries?: number;
  maxGroups?: number;
};

const defaultSummary = (): SeriesBackfillSummary => ({
  proposedSeriesCount: 0,
  insertedSeriesCount: 0,
  reusedSeriesCount: 0,
  linkedEditionsCount: 0,
  skippedAmbiguousEditionsCount: 0,
  skippedGroupsCount: 0,
  proposedAliasesCount: 0,
  insertedAliasesCount: 0,
  skippedRiskyAliasesCount: 0
});

function slugifySeriesBase(s: string): string {
  const x = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (x.slice(0, 118) || "series").replace(/-+/g, "-");
}

function proposeSeriesSlug(stem: string, city: string | null, country: string | null): string {
  const c = normalizedGeoCity(city) || "unknown-city";
  const co = normalizedGeoCountry(country) || "unknown-country";
  return slugifySeriesBase(`${stem}-${c}-${co}`);
}

function proposeSeriesDisplayName(editions: CanonRaceEditionRow[]): string {
  const dated = [...editions].filter((e) => e.start_date?.trim());
  const sorted = (dated.length ? dated : [...editions]).sort((a, b) =>
    (a.start_date ?? "").localeCompare(b.start_date ?? "")
  );
  const raw = sorted[0]?.name?.trim() || editions[0]?.name?.trim() || "Event series";
  const stripped = stripYearTokensFromNormalized(normalizeRaceName(raw)).replace(/\s+/g, " ").trim();
  return stripped || raw;
}

async function fetchEligibleEditions(client: SupabaseClient): Promise<CanonRaceEditionRow[]> {
  const pageSize = 500;
  const out: CanonRaceEditionRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("canonical_races")
      .select(
        "id,name,slug,city,country,region,start_date,distance_km,series_id,status"
      )
      .is("series_id", null)
      .in("status", [...ELIGIBLE_STATUSES])
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`canonical_races fetch: ${error.message}`);
    const rows = (data ?? []) as CanonRaceEditionRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function getSeriesBySlug(client: SupabaseClient, slug: string): Promise<{ id: string } | null> {
  const { data, error } = await client.from("canonical_race_series").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`canonical_race_series lookup: ${error.message}`);
  return data as { id: string } | null;
}

async function aliasExistsForSeries(
  client: SupabaseClient,
  seriesId: string,
  aliasNormalized: string
): Promise<boolean> {
  const { data, error } = await client
    .from("canonical_race_alias")
    .select("id")
    .eq("series_id", seriesId)
    .eq("alias_normalized", aliasNormalized)
    .maybeSingle();
  if (error) throw new Error(`canonical_race_alias series lookup: ${error.message}`);
  return data != null;
}

async function aliasExistsForRace(
  client: SupabaseClient,
  raceId: string,
  aliasNormalized: string
): Promise<boolean> {
  const { data, error } = await client
    .from("canonical_race_alias")
    .select("id")
    .eq("race_id", raceId)
    .eq("alias_normalized", aliasNormalized)
    .maybeSingle();
  if (error) throw new Error(`canonical_race_alias race lookup: ${error.message}`);
  return data != null;
}

function collectDistinctYears(editions: CanonRaceEditionRow[]): number[] {
  const ys = new Set<number>();
  for (const e of editions) {
    const y = startDateYear(e.start_date);
    if (y != null) ys.add(y);
  }
  return [...ys].sort((a, b) => a - b);
}

export async function runSeriesBackfillWorkflow(
  client: SupabaseClient,
  opts: RunSeriesBackfillOptions
): Promise<SeriesBackfillResult> {
  const logs: SeriesBackfillLogEntry[] = [];
  const summary = defaultSummary();

  const editions = await fetchEligibleEditions(client);
  const buckets = new Map<string, CanonRaceEditionRow[]>();

  for (const e of editions) {
    const key = makeGroupingKey(e.name, e.city, e.country);
    if (!key) continue;
    const stem = editionNameStem(e.name);
    if (!isStemStrongEnough(stem)) continue;

    const c = normalizedGeoCity(e.city);
    const co = normalizedGeoCountry(e.country);
    if (!co && !c) continue;

    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(e);
  }

  let groupsProcessed = 0;
  let newSeriesBudget = opts.maxNewSeries ?? Number.POSITIVE_INFINITY;
  const grouped = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [groupingKey, groupEditions] of grouped) {
    if (opts.maxGroups != null && groupsProcessed >= opts.maxGroups) break;
    groupsProcessed++;

    const reasonSkip = (reason: string) => {
      summary.skippedGroupsCount++;
      logs.push({
        kind: "group_skipped",
        groupingKey,
        reason,
        editionIds: groupEditions.map((e) => e.id)
      });
    };

    if (groupEditions.length < opts.minEditions) {
      reasonSkip(`need at least ${opts.minEditions} editions`);
      continue;
    }

    const stems = new Set(groupEditions.map((e) => editionNameStem(e.name)));
    if (stems.size !== 1) {
      reasonSkip("multiple distinct name stems in same geo bucket — ambiguous");
      continue;
    }

    const years = collectDistinctYears(groupEditions);
    if (years.length < opts.minDistinctYears) {
      reasonSkip(`need at least ${opts.minDistinctYears} distinct start years (got ${years.length})`);
      continue;
    }

    const kms = groupEditions.map((e) => e.distance_km);
    if (!distancesCoherent(opts.maxDistanceSpreadRatio, kms)) {
      reasonSkip("distance_km spread too large across editions");
      continue;
    }

    const [city, country] = [groupEditions[0]!.city, groupEditions[0]!.country];
    const stem = [...stems][0]!;
    const slug = proposeSeriesSlug(stem, city, country);
    const seriesName = proposeSeriesDisplayName(groupEditions);

    summary.proposedSeriesCount++;
    logs.push({
      kind: "series_proposed",
      groupingKey,
      proposedSlug: slug,
      proposedSeriesName: seriesName,
      city,
      country,
      editionCount: groupEditions.length,
      distinctYears: years,
      rationale: `stem+geo key; ${groupEditions.length} editions; years ${years.join(", ")}; max distance spread ${opts.maxDistanceSpreadRatio}`
    });

    const preExisting = await getSeriesBySlug(client, slug);
    let effectiveSeriesId: string | null = preExisting?.id ?? null;

    if (preExisting) {
      summary.reusedSeriesCount++;
      logs.push({
        kind: "series_reused",
        seriesId: preExisting.id,
        slug,
        name: seriesName,
        dryRun: opts.dryRun
      });
    } else {
      if (newSeriesBudget <= 0) {
        summary.proposedSeriesCount--;
        reasonSkip("maxNewSeries budget exhausted for this run");
        continue;
      }
      if (opts.dryRun) {
        logs.push({
          kind: "series_inserted",
          seriesId: `(dry-run new series → ${slug})`,
          slug,
          name: seriesName,
          dryRun: true
        });
        effectiveSeriesId = `(dry-run new series → ${slug})`;
      } else {
        const meta = {
          backfill_run_id: opts.backfillRunId,
          grouping_key: groupingKey,
          backfill_version: 1
        };
        const { data: inserted, error: insErr } = await client
          .from("canonical_race_series")
          .insert({
            slug,
            name: seriesName,
            city,
            country,
            region: groupEditions[0]?.region ?? null,
            metadata: meta
          })
          .select("id")
          .single();
        if (insErr) {
          summary.proposedSeriesCount--;
          reasonSkip(`insert failed: ${insErr.message}`);
          continue;
        }
        effectiveSeriesId = (inserted as { id: string }).id;
        summary.insertedSeriesCount++;
        newSeriesBudget--;
        logs.push({
          kind: "series_inserted",
          seriesId: effectiveSeriesId,
          slug,
          name: seriesName,
          dryRun: false
        });
      }
    }

    const rationale = `grouping_key=${groupingKey}; single stem; ${years.length} distinct years; distance coherent`;

    for (const e of groupEditions) {
      if (opts.dryRun) {
        logs.push({
          kind: "edition_linked",
          editionId: e.id,
          editionName: e.name,
          seriesId: effectiveSeriesId!,
          groupingKey,
          city: e.city,
          country: e.country,
          rationale,
          dryRun: true
        });
        summary.linkedEditionsCount++;
        continue;
      }

      const { error: uErr } = await client
        .from("canonical_races")
        .update({ series_id: effectiveSeriesId, updated_at: new Date().toISOString() })
        .eq("id", e.id)
        .is("series_id", null);
      if (uErr) {
        summary.skippedAmbiguousEditionsCount++;
        logs.push({
          kind: "edition_skipped_ambiguous",
          editionId: e.id,
          editionName: e.name,
          groupingKey,
          reason: `update failed: ${uErr.message}`,
          city: e.city,
          country: e.country
        });
        continue;
      }
      logs.push({
        kind: "edition_linked",
        editionId: e.id,
        editionName: e.name,
        seriesId: effectiveSeriesId!,
        groupingKey,
        city: e.city,
        country: e.country,
        rationale,
        dryRun: false
      });
      summary.linkedEditionsCount++;
    }

    await seedAliasesForGroup(client, {
      seriesId: effectiveSeriesId!,
      seriesName,
      stem,
      editions: groupEditions,
      dryRun: opts.dryRun,
      summary,
      logs
    });
  }

  return { summary, logs };
}

async function seedAliasesForGroup(
  client: SupabaseClient,
  args: {
    seriesId: string;
    seriesName: string;
    stem: string;
    editions: CanonRaceEditionRow[];
    dryRun: boolean;
    summary: SeriesBackfillSummary;
    logs: SeriesBackfillLogEntry[];
  }
): Promise<void> {
  const { seriesId, seriesName, stem, editions, dryRun, summary, logs } = args;
  const seriesNorm = normalizeAliasForMatch(seriesName);

  const trySeriesAlias = async (raw: string, source: string, kind: string, rationale: string) => {
    const trimmed = raw.trim();
    const norm = normalizeAliasForMatch(trimmed);
    if (!trimmed || norm === seriesNorm) return;
    if (editionNameStem(trimmed) !== stem) {
      summary.skippedRiskyAliasesCount++;
      logs.push({
        kind: "alias_skipped_risky",
        scope: "series",
        targetId: seriesId,
        aliasText: trimmed,
        reason: "stem mismatch — not promoted to series-level alias"
      });
      return;
    }
    if (isRiskyAliasText(trimmed, norm)) {
      summary.skippedRiskyAliasesCount++;
      logs.push({
        kind: "alias_skipped_risky",
        scope: "series",
        targetId: seriesId,
        aliasText: trimmed,
        reason: "generic/short alias heuristic"
      });
      return;
    }

    summary.proposedAliasesCount++;
    if (dryRun) {
      logs.push({
        kind: "alias_proposed",
        scope: "series",
        targetId: seriesId,
        aliasText: trimmed,
        aliasNormalized: norm,
        aliasKind: kind,
        source,
        rationale,
        dryRun: true
      });
      return;
    }
    if (seriesId.startsWith("(dry-run")) return;
    if (await aliasExistsForSeries(client, seriesId, norm)) return;

    const { error } = await client.from("canonical_race_alias").insert({
      series_id: seriesId,
      race_id: null,
      alias_text: trimmed,
      alias_normalized: norm,
      kind
    });
    if (error) {
      summary.skippedRiskyAliasesCount++;
      logs.push({
        kind: "alias_skipped_risky",
        scope: "series",
        targetId: seriesId,
        aliasText: trimmed,
        reason: error.message
      });
      return;
    }
    summary.insertedAliasesCount++;
    logs.push({
      kind: "alias_inserted",
      scope: "series",
      targetId: seriesId,
      aliasText: trimmed,
      aliasNormalized: norm,
      aliasKind: kind,
      source,
      rationale,
      dryRun: false
    });
  };

  for (const e of editions) {
    const rawName = e.name.trim();
    const n = normalizeAliasForMatch(rawName);
    if (n === seriesNorm) continue;

    if (editionNameStem(rawName) === stem) {
      await trySeriesAlias(
        rawName,
        `edition:${e.id}`,
        "variant",
        "same name stem as series; raw edition title differs (year/sponsor tokens)"
      );
    } else {
      if (isRiskyAliasText(rawName, n)) {
        summary.skippedRiskyAliasesCount++;
        logs.push({
          kind: "alias_skipped_risky",
          scope: "edition",
          targetId: e.id,
          aliasText: rawName,
          reason: "edition alias failed generic/short heuristic"
        });
        continue;
      }
      summary.proposedAliasesCount++;
      if (dryRun) {
        logs.push({
          kind: "alias_proposed",
          scope: "edition",
          targetId: e.id,
          aliasText: rawName,
          aliasNormalized: n,
          aliasKind: "official",
          source: "edition.name",
          rationale: "stem differs from series stem — edition-only official title",
          dryRun: true
        });
        continue;
      }
      if (seriesId.startsWith("(dry-run")) continue;
      if (await aliasExistsForRace(client, e.id, n)) continue;
      const { error } = await client.from("canonical_race_alias").insert({
        series_id: null,
        race_id: e.id,
        alias_text: rawName,
        alias_normalized: n,
        kind: "official"
      });
      if (error) {
        summary.skippedRiskyAliasesCount++;
        logs.push({
          kind: "alias_skipped_risky",
          scope: "edition",
          targetId: e.id,
          aliasText: rawName,
          reason: error.message
        });
        continue;
      }
      summary.insertedAliasesCount++;
      logs.push({
        kind: "alias_inserted",
        scope: "edition",
        targetId: e.id,
        aliasText: rawName,
        aliasNormalized: n,
        aliasKind: "official",
        source: "edition.name",
        rationale: "stem differs from series stem — edition-only official title",
        dryRun: false
      });
    }
  }

  const distinctSlugs = [...new Set(editions.map((e) => e.slug).filter((s) => s?.trim()))];
  for (const sl of distinctSlugs) {
    const slugAsName = sl.replace(/-/g, " ");
    if (editionNameStem(slugAsName) !== stem) continue;
    if (normalizeAliasForMatch(slugAsName) === seriesNorm) continue;
    await trySeriesAlias(slugAsName, `slug:${sl}`, "variant", "canonical slug aligns with series stem");
  }
}
