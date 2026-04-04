import { createHash } from "node:crypto";
import { fetchRacePageHtml } from "@/lib/races/canonical/enrichment/fetch-page";
import { extractPageEnrichment } from "@/lib/races/canonical/enrichment/extract-html-meta";
import { selectEnrichmentImages } from "@/lib/races/canonical/enrichment/select-images";
import { mergeOfficialPageIntoCanonical } from "@/lib/races/canonical/enrichment/merge-official-page";
import {
  brandedFallbackCardAbsoluteUrl,
  brandedFallbackCardPath
} from "@/lib/races/canonical/enrichment/branded-fallback";
import {
  getCanonicalRaceById,
  maxSourceTrustForRaceExcluding,
  updateCanonicalRace,
  upsertRaceSourceRow
} from "@/lib/races/canonical/repository";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";
import type { CanonicalRace } from "@/lib/races/canonical/types";

function pickFetchUrl(race: CanonicalRace): string | null {
  return race.officialUrl?.trim() || race.registrationUrl?.trim() || null;
}

function hashExtractSnapshot(extract: { finalUrl: string; pageTitle: string | null; ogImage: string | null }): string {
  return createHash("sha256").update(JSON.stringify(extract)).digest("hex");
}

async function loadSeriesLogo(seriesId: string | null): Promise<string | null> {
  if (!seriesId?.trim()) return null;
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("canonical_race_series")
    .select("metadata")
    .eq("id", seriesId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const m = (data as { metadata?: Record<string, unknown> }).metadata;
  const u = m?.logo_url ?? m?.logoUrl;
  return typeof u === "string" && u.startsWith("http") ? u : null;
}

export type RunEnrichmentResult =
  | { ok: true; raceId: string; action: "enriched" | "skipped" }
  | { ok: false; raceId: string; error: string };

/**
 * Single edition enrichment: fetch official/registration URL, extract signals, merge into canonical row.
 * Intended for workers / cron — not page load.
 */
export async function runCanonicalRaceEnrichment(raceId: string): Promise<RunEnrichmentResult> {
  const raceRes = await getCanonicalRaceById(raceId);
  if (!raceRes.ok) return { ok: false, raceId, error: raceRes.error };
  const current = raceRes.data;
  if (!current) return { ok: false, raceId, error: "Race not found." };

  const now = () => new Date().toISOString();

  const url = pickFetchUrl(current);
  if (!url) {
    const upd = await updateCanonicalRace({
      ...current,
      enrichmentStatus: "skipped",
      lastEnrichedAt: now(),
      enrichmentMeta: { ...current.enrichmentMeta, skipReason: "no_official_or_registration_url" },
      updatedAt: now()
    });
    if (!upd.ok) return { ok: false, raceId, error: upd.error };
    return { ok: true, raceId, action: "skipped" };
  }

  await updateCanonicalRace({
    ...current,
    enrichmentStatus: "running",
    enrichmentMeta: { ...current.enrichmentMeta, fetchStartedAt: now(), fetchUrl: url.slice(0, 240) },
    updatedAt: now()
  });

  const fetched = await fetchRacePageHtml(url);
  if (!fetched.ok) {
    await updateCanonicalRace({
      ...current,
      enrichmentStatus: "failed",
      lastEnrichedAt: now(),
      enrichmentMeta: { ...current.enrichmentMeta, lastError: fetched.message },
      updatedAt: now()
    });
    return { ok: false, raceId, error: fetched.message };
  }

  const extract = extractPageEnrichment(fetched.html, fetched.finalUrl);
  const images = selectEnrichmentImages(extract);
  const trustRes = await maxSourceTrustForRaceExcluding(raceId, {
    source: "official_page",
    sourceRaceId: raceId
  });
  const existingMax = trustRes.ok ? trustRes.data : 0;
  const seriesLogo = await loadSeriesLogo(current.seriesId);

  const absFallback = brandedFallbackCardAbsoluteUrl(raceId);
  const pathFallback = brandedFallbackCardPath(raceId);
  const fallbackImageUrl = absFallback ?? pathFallback;

  const { race: merged, usedGeneratedSummary } = mergeOfficialPageIntoCanonical({
    current,
    editionId: raceId,
    extract,
    images,
    existingMaxSourceTrust: existingMax,
    seriesLogoUrl: seriesLogo,
    fallbackImageUrl
  });

  const ts = now();
  const enrichmentMeta: Record<string, unknown> = {
    ...merged.enrichmentMeta,
    fetchedUrl: extract.finalUrl,
    imageQualityScore: images.imageQualityScore,
    sourceTrust: 88,
    metadataCompletenessAfter: merged.completenessScore,
    usedGeneratedSummary,
    usedFallbackCard: Boolean(
      merged.fallbackImageUrl?.includes("fallback-image") &&
        !current.heroImageUrl?.trim() &&
        !current.logoUrl?.trim()
    )
  };

  const finalRace: CanonicalRace = {
    ...merged,
    enrichmentStatus: "complete",
    lastEnrichedAt: ts,
    enrichmentMeta,
    updatedAt: ts
  };

  const updated = await updateCanonicalRace(finalRace);
  if (!updated.ok) {
    await updateCanonicalRace({
      ...current,
      enrichmentStatus: "failed",
      lastEnrichedAt: now(),
      enrichmentMeta: { ...current.enrichmentMeta, lastError: updated.error },
      updatedAt: now()
    });
    return { ok: false, raceId, error: updated.error };
  }

  const sourceUpsert = await upsertRaceSourceRow({
    raceId,
    source: "official_page",
    sourceRaceId: raceId,
    sourceUrl: extract.finalUrl,
    rawPayload: { extract: { finalUrl: extract.finalUrl, title: extract.pageTitle }, htmlLen: fetched.html.length },
    rawHash: hashExtractSnapshot({
      finalUrl: extract.finalUrl,
      pageTitle: extract.pageTitle,
      ogImage: extract.ogImage
    }),
    mappedFields: { imageQualityScore: images.imageQualityScore },
    now: ts
  });
  if (!sourceUpsert.ok) {
    runfolioLog.warn("enrichment.sourceUpsert", sourceUpsert.error, { raceId });
  }

  runfolioLog.info("enrichment.complete", "ok", { raceId: raceId.slice(0, 8) });
  return { ok: true, raceId, action: "enriched" };
}
