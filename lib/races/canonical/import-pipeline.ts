/**
 * Canonical import: normalized provider row → edition (`canonical_races`) + source fingerprint.
 *
 * Scaling / series-aware ingest (next steps, not all wired yet):
 * - Resolve or create `canonical_race_series` from provider series id / name, set `NormalizedRace.canonicalSeriesId`.
 * - Upsert `canonical_race_alias` rows (official, short, sponsor variants) keyed by `series_id` or `race_id`.
 * - Batch slug allocation and duplicate detection across large dumps (marathon directories, trail catalogs).
 */
import { randomUUID } from "node:crypto";
import { normalizeRaceName } from "@/lib/races/dedupe";
import { canonicalFromNormalizedSeed, mergeCanonicalFromNormalized } from "@/lib/races/canonical/merge-canonical";
import { recomputeCanonicalScores } from "@/lib/races/canonical/scoring";
import { mappedFieldsFromNormalized } from "@/lib/races/canonical/mapped-fields";
import { pickBestCanonicalMatch } from "@/lib/races/canonical/match";
import { hashRawPayload } from "@/lib/races/canonical/raw-hash";
import {
  allocateUniqueSlug,
  findImportMatchCandidates,
  getCanonicalRaceById,
  getSourceByProviderKey,
  insertCanonicalRace,
  maxSourceTrustForRaceExcluding,
  touchRaceSourceSyncedAt,
  updateCanonicalRace,
  upsertRaceSourceRow
} from "@/lib/races/canonical/repository";
import { sourceTrustRank } from "@/lib/races/canonical/source-trust";
import type { CanonicalRace, CanonicalRaceStatus } from "@/lib/races/canonical/types";
import type { NormalizedRace } from "@/lib/races/types/normalized";
import { runfolioLog } from "@/lib/runfolio-log";
import { baseSlugFromNormalized } from "@/lib/races/canonical/slug";

export type CanonicalImportAction = "created" | "linked" | "updated" | "noop";

export type CanonicalImportResult =
  | { ok: true; action: CanonicalImportAction; raceId: string; sourceId: string }
  | { ok: false; error: string };

/** Pure check used for tests / tooling: unchanged provider payload ⇒ skip merge. */
export function isUnchangedCanonicalPayload(
  existingHash: string | null | undefined,
  newHash: string,
  options?: { skipUnchangedPayload?: boolean }
): boolean {
  const skip = options?.skipUnchangedPayload !== false;
  return skip && existingHash != null && existingHash === newHash;
}

function sourceUrlFromNormalized(n: NormalizedRace): string | null {
  return n.officialUrl?.trim() || n.registrationUrl?.trim() || null;
}

function startDateYmd(n: NormalizedRace): string | null {
  return n.startDate ? n.startDate.slice(0, 10) : null;
}

function nameQueryTokens(n: NormalizedRace): string[] {
  return normalizeRaceName(n.name)
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

function logMergeFieldChanges(before: CanonicalRace, after: CanonicalRace, meta: Record<string, string>) {
  const keys = ["name", "officialUrl", "startDate", "distanceKm", "city", "country"] as const;
  for (const k of keys) {
    const bv = before[k];
    const av = after[k];
    if (bv != null && av != null && bv !== av) {
      runfolioLog.warn("canonical.import.merge_conflict", `field:${k}`, {
        ...meta,
        before: String(bv),
        after: String(av)
      });
    }
  }
}

async function applyMergeToCanonicalRace(
  before: CanonicalRace,
  merged: CanonicalRace,
  meta: { raceId: string; source: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  logMergeFieldChanges(before, merged, { raceId: meta.raceId, source: meta.source });
  const updated = await updateCanonicalRace({ ...merged, updatedAt: new Date().toISOString() });
  if (!updated.ok) {
    runfolioLog.error("canonical.import.persistRace", new Error(updated.error), { raceId: meta.raceId });
    return { ok: false, error: updated.error };
  }
  return { ok: true };
}

/**
 * Import one normalized provider row into the canonical layer (idempotent on `raw_hash`).
 * `statusOnCreate` applies only when inserting a new `canonical_races` row (not on merge/link).
 */
export async function importNormalizedRace(
  normalized: NormalizedRace,
  options?: { skipUnchangedPayload?: boolean; statusOnCreate?: CanonicalRaceStatus }
): Promise<CanonicalImportResult> {
  const skipUnchanged = options?.skipUnchangedPayload !== false;
  const now = new Date().toISOString();
  const rawHash = hashRawPayload(normalized.rawPayload ?? {});
  const mapped = mappedFieldsFromNormalized(normalized);
  const sourceUrl = sourceUrlFromNormalized(normalized);
  const incomingTrust = sourceTrustRank(normalized.source);

  runfolioLog.info("canonical.import.attempt", "start", {
    source: normalized.source,
    sourceRaceId: normalized.sourceRaceId
  });

  const existingSource = await getSourceByProviderKey(normalized.source, normalized.sourceRaceId);
  if (!existingSource.ok) {
    runfolioLog.error("canonical.import.error", new Error(existingSource.error), {});
    return { ok: false, error: existingSource.error };
  }

  if (existingSource.data && isUnchangedCanonicalPayload(existingSource.data.rawHash, rawHash, options)) {
    const touched = await touchRaceSourceSyncedAt(existingSource.data.id, now);
    if (!touched.ok) return { ok: false, error: touched.error };
    runfolioLog.info("canonical.import.noop", "unchanged payload", {
      source: normalized.source,
      sourceRaceId: normalized.sourceRaceId,
      raceId: existingSource.data.raceId
    });
    return {
      ok: true,
      action: "noop",
      raceId: existingSource.data.raceId,
      sourceId: existingSource.data.id
    };
  }

  if (existingSource.data) {
    const raceId = existingSource.data.raceId;
    const raceRes = await getCanonicalRaceById(raceId);
    if (!raceRes.ok) return { ok: false, error: raceRes.error };
    if (!raceRes.data) {
      runfolioLog.error("canonical.import.error", new Error("orphan_source_missing_race"), { raceId });
      return { ok: false, error: "Canonical race missing for source link." };
    }
    const trustRes = await maxSourceTrustForRaceExcluding(raceId, {
      source: normalized.source,
      sourceRaceId: normalized.sourceRaceId
    });
    if (!trustRes.ok) return { ok: false, error: trustRes.error };
    const before = raceRes.data;
    const merged = mergeCanonicalFromNormalized(before, normalized, {
      incomingSource: normalized.source,
      incomingTrust,
      existingTrustHint: trustRes.data
    });
    const persist = await applyMergeToCanonicalRace(before, merged, { raceId, source: normalized.source });
    if (!persist.ok) return { ok: false, error: persist.error };
    const src = await upsertRaceSourceRow({
      id: existingSource.data.id,
      raceId,
      source: normalized.source,
      sourceRaceId: normalized.sourceRaceId,
      sourceUrl,
      rawPayload: normalized.rawPayload,
      rawHash,
      mappedFields: mapped,
      now
    });
    if (!src.ok) {
      runfolioLog.error("canonical.import.error", new Error(src.error), {});
      return { ok: false, error: src.error };
    }
    runfolioLog.info("canonical.import.updated", "merged", { raceId, sourceId: src.data.id });
    return { ok: true, action: "updated", raceId, sourceId: src.data.id };
  }

  const cand = await findImportMatchCandidates({
    nameTokens: nameQueryTokens(normalized),
    startDateYmd: startDateYmd(normalized)
  });
  if (!cand.ok) {
    runfolioLog.error("canonical.import.error", new Error(cand.error), {});
    return { ok: false, error: cand.error };
  }
  const match = pickBestCanonicalMatch(normalized, cand.data);

  if (match) {
    runfolioLog.info("canonical.import.match", "linked to existing", {
      raceId: match.id,
      source: normalized.source,
      sourceRaceId: normalized.sourceRaceId
    });
    const trustRes = await maxSourceTrustForRaceExcluding(match.id);
    if (!trustRes.ok) return { ok: false, error: trustRes.error };
    const before = match;
    const merged = mergeCanonicalFromNormalized(before, normalized, {
      incomingSource: normalized.source,
      incomingTrust,
      existingTrustHint: trustRes.data
    });
    const persist = await applyMergeToCanonicalRace(before, merged, { raceId: match.id, source: normalized.source });
    if (!persist.ok) return { ok: false, error: persist.error };
    const src = await upsertRaceSourceRow({
      raceId: match.id,
      source: normalized.source,
      sourceRaceId: normalized.sourceRaceId,
      sourceUrl,
      rawPayload: normalized.rawPayload,
      rawHash,
      mappedFields: mapped,
      now
    });
    if (!src.ok) return { ok: false, error: src.error };
    runfolioLog.info("canonical.import.link", "new source row", { raceId: match.id, sourceId: src.data.id });
    return { ok: true, action: "linked", raceId: match.id, sourceId: src.data.id };
  }

  const raceId = randomUUID();
  const base = baseSlugFromNormalized(normalized);
  const slugRes = await allocateUniqueSlug(base);
  if (!slugRes.ok) {
    runfolioLog.error("canonical.import.error", new Error(slugRes.error), {});
    return { ok: false, error: slugRes.error };
  }
  let seeded = canonicalFromNormalizedSeed(normalized, slugRes.data, raceId, now);
  if (options?.statusOnCreate) {
    seeded = recomputeCanonicalScores({ ...seeded, status: options.statusOnCreate });
  }
  const inserted = await insertCanonicalRace(seeded);
  if (!inserted.ok) {
    runfolioLog.error("canonical.import.error", new Error(inserted.error), { slug: slugRes.data });
    return { ok: false, error: inserted.error };
  }
  const src = await upsertRaceSourceRow({
    raceId: inserted.data.id,
    source: normalized.source,
    sourceRaceId: normalized.sourceRaceId,
    sourceUrl,
    rawPayload: normalized.rawPayload,
    rawHash,
    mappedFields: mapped,
    now
  });
  if (!src.ok) return { ok: false, error: src.error };
  runfolioLog.info("canonical.import.create", "new canonical race", {
    raceId: inserted.data.id,
    sourceId: src.data.id
  });
  return { ok: true, action: "created", raceId: inserted.data.id, sourceId: src.data.id };
}

export async function importNormalizedRacesBatch(
  races: NormalizedRace[],
  options?: { skipUnchangedPayload?: boolean; statusOnCreate?: CanonicalRaceStatus }
): Promise<CanonicalImportResult[]> {
  const out: CanonicalImportResult[] = [];
  for (const r of races) {
    out.push(await importNormalizedRace(r, options));
  }
  return out;
}
