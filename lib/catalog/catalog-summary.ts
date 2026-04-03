import type { DiscoverRace } from "@/lib/discover-race-schema";
import type { DiscoverGroup } from "@/lib/discover-races-constants";

/** Human-readable notes for dev tools / docs — not used by matchers. */
export const CATALOG_EXPANSION_NOTES = {
  /** Races we deliberately avoid until we have unique titles + geo (false-positive risk). */
  intentionallySkippedExamples: [
    "Bare “spring half marathon” / city-only half titles without event branding",
    "Duplicate-tier events in the same city/month without sponsor cues (e.g. second London half without “Big Half” / “Royal Parks” phrasing)",
    "Regional 10K mass races with non-distinctive names",
    "National championship editions that change city year to year without stable branding"
  ] as const,
  suggestedNextWaves: [
    "Oceania: Melbourne, Auckland, Gold Coast marathons",
    "Americas: CIM Sacramento, Philadelphia, Detroit Free Press, Mexico City",
    "Europe: Frankfurt, Warsaw, Athens Authentic, Lisbon",
    "Asia: Taipei, Singapore Marathon, Fukuoka",
    "UK/Ireland: Dublin Marathon, Belfast City Marathon, Manchester→Leeds corridor halves",
    "Canonical DB: continue series_id + alias backfill for provider-sourced editions"
  ] as const
};

export type DiscoverCatalogSummary = {
  totalDiscoverRaces: number;
  byGroup: Record<DiscoverGroup, number>;
  withStructuredCountry: number;
  withCity: number;
  withCoordinates: number;
  withAliases: number;
  withOfficialName: number;
  withEditionDateMetadata: number;
  flagshipTierCount: number;
  validationErrorCount: number;
  validationWarningCount: number;
};

export function computeDiscoverCatalogSummary(
  races: readonly DiscoverRace[],
  validation?: { errors: number; warnings: number }
): DiscoverCatalogSummary {
  const byGroup: Record<DiscoverGroup, number> = {
    major_marathons: 0,
    utmb: 0,
    global_trail: 0,
    epic_endurance: 0
  };
  for (const r of races) {
    byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;
  }

  const withEditionDateMetadata = races.filter(
    (r) => Boolean(r.edition_date_anchor_ymd?.trim() || r.edition_date_quality)
  ).length;

  return {
    totalDiscoverRaces: races.length,
    byGroup,
    withStructuredCountry: races.filter((r) => Boolean(r.country?.trim())).length,
    withCity: races.filter((r) => Boolean(r.city?.trim())).length,
    withCoordinates: races.filter((r) => r.latitude != null && r.longitude != null).length,
    withAliases: races.filter((r) => (r.aliases?.length ?? 0) > 0).length,
    withOfficialName: races.filter((r) => Boolean(r.official_name?.trim())).length,
    withEditionDateMetadata,
    flagshipTierCount: races.filter((r) => r.match_tier === "flagship").length,
    validationErrorCount: validation?.errors ?? 0,
    validationWarningCount: validation?.warnings ?? 0
  };
}
