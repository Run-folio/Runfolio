import { mergeCanonicalFromNormalized } from "@/lib/races/canonical/merge-canonical";
import { sourceTrustRank } from "@/lib/races/canonical/source-trust";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { EnrichmentImagePick, PageEnrichmentExtract } from "@/lib/races/canonical/enrichment/types";
import { synthesizeRaceSummary } from "@/lib/races/canonical/enrichment/synthesize-summary";
import { recomputeCanonicalScores } from "@/lib/races/canonical/scoring";
import { buildInternalRaceId } from "@/lib/races/id";
import type { NormalizedRace } from "@/lib/races/types/normalized";

function longerString(a: string | null, b: string | null): string | null {
  if (!a?.trim()) return b ?? null;
  if (!b?.trim()) return a ?? null;
  return a.length >= b.length ? a : b;
}

function isLocked(locks: Record<string, boolean>, field: string): boolean {
  return locks[field] === true;
}

function longestText(...xs: (string | null | undefined)[]): string | null {
  const list = xs.filter((x): x is string => Boolean(x?.trim()));
  if (!list.length) return null;
  return list.reduce((a, b) => (b.length > a.length ? b : a));
}

function normalizedFromExtract(
  editionId: string,
  current: CanonicalRace,
  extract: PageEnrichmentExtract,
  images: EnrichmentImagePick
): NormalizedRace {
  const shortDesc = longestText(extract.ogDescription, extract.metaDescription, extract.jsonLdSummaries[0]);
  const tags = [...new Set([...current.categoryTags, "enrichment:official_page"])].slice(0, 48);

  return {
    id: buildInternalRaceId("official_page", editionId),
    source: "official_page",
    sourceRaceId: editionId,
    name: current.name,
    slug: current.slug,
    description: shortDesc,
    organizerName: null,
    officialUrl: current.officialUrl?.trim() ? null : extract.finalUrl,
    registrationUrl: null,
    logoUrl: images.logoUrl,
    heroImageUrl: images.heroUrl,
    country: null,
    region: null,
    city: null,
    venue: null,
    latitude: null,
    longitude: null,
    startDate: null,
    endDate: null,
    timezone: null,
    distanceKm: null,
    elevationGainM: null,
    raceType: null,
    surfaceType: null,
    categoryTags: tags,
    difficultyScore: null,
    utmbIndexEligible: null,
    utmbCategory: null,
    isTrail: null,
    isRoad: null,
    isUltra: null,
    createdAt: null,
    updatedAt: null,
    rawPayload: {
      enrichment: true,
      fetchedUrl: extract.finalUrl,
      pageTitle: extract.pageTitle
    }
  };
}

/**
 * Merge trusted page extract using existing canonical merge rules, then layer long copy, distances, and fallback image.
 */
export function mergeOfficialPageIntoCanonical(args: {
  current: CanonicalRace;
  editionId: string;
  extract: PageEnrichmentExtract;
  images: EnrichmentImagePick;
  existingMaxSourceTrust: number;
  seriesLogoUrl?: string | null;
  fallbackImageUrl: string | null;
}): { race: CanonicalRace; usedGeneratedSummary: boolean } {
  const { current, editionId, extract, images, existingMaxSourceTrust, seriesLogoUrl, fallbackImageUrl } = args;
  const incomingTrust = sourceTrustRank("official_page");

  let img = { ...images };
  if (!img.logoUrl && seriesLogoUrl?.trim()) {
    img = { ...img, logoUrl: seriesLogoUrl.trim() };
  }

  const norm = normalizedFromExtract(editionId, current, extract, img);
  let next = mergeCanonicalFromNormalized(current, norm, {
    incomingSource: "official_page",
    incomingTrust,
    existingTrustHint: existingMaxSourceTrust
  });

  const longBody = longestText(
    ...extract.jsonLdSummaries.filter((s) => s.length > 80),
    extract.ogDescription,
    extract.snippetText
  );

  const locks = next.curationLocked;
  if (!isLocked(locks, "longDescription")) {
    next = { ...next, longDescription: longerString(next.longDescription, longBody) };
  }

  if (!isLocked(locks, "distanceOptionsKm")) {
    const merged = new Set<number>([...(next.distanceOptionsKm ?? []), ...extract.distanceHintsKm]);
    const arr = [...merged].filter((n) => n > 0 && n < 600).sort((a, b) => a - b);
    if (arr.length) {
      next = { ...next, distanceOptionsKm: arr };
    }
  }

  let usedGeneratedSummary = false;
  const thin = !next.description?.trim() || next.description.length < 24;
  if (thin && !isLocked(locks, "description")) {
    next = { ...next, description: synthesizeRaceSummary(next) };
    usedGeneratedSummary = true;
  }

  if (!isLocked(locks, "fallbackImageUrl")) {
    if (next.heroImageUrl?.trim() || next.logoUrl?.trim()) {
      next = { ...next, fallbackImageUrl: null };
    } else if (fallbackImageUrl?.trim()) {
      next = { ...next, fallbackImageUrl: fallbackImageUrl };
    }
  }

  next = recomputeCanonicalScores(next);
  return { race: next, usedGeneratedSummary };
}
