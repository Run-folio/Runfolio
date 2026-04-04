import type { RaceIngestSource } from "@/lib/races/types/normalized";

/**
 * Trust rank for automated merge tie-breakers (higher = prefer when rules tie).
 * Tweak here — avoid scattering magic numbers across merge logic.
 *
 * Rationale (high level):
 * - Branding/enrichment-first providers win logos/metadata.
 * - Major listing APIs (ACTIVE, RunSignup) beat generic stubs.
 * - Curated app catalog (utmb_catalog) is authoritative for trail/UTMB shape but may lack registration URLs.
 * - Mock is lowest.
 */
const TRUST_RANK: Record<RaceIngestSource, number> = {
  raceresult: 100,
  manual: 95,
  /** Official site HTML signals (og:image, JSON-LD) — strong for imagery/copy when domain aligns. */
  official_page: 88,
  active: 82,
  runsignup: 78,
  utmb_catalog: 72,
  /** Dated canonical editions + series metadata from curated UTMB ingest (preferred over catalog stubs for merge). */
  utmb_ws: 76,
  chronotrack: 65,
  mock: 10
};

export function sourceTrustRank(source: RaceIngestSource): number {
  return TRUST_RANK[source] ?? 50;
}

/** Ordered list for docs / admin tooling */
export function listSourceTrustOrder(): RaceIngestSource[] {
  return (Object.keys(TRUST_RANK) as RaceIngestSource[]).sort((a, b) => TRUST_RANK[b]! - TRUST_RANK[a]!);
}
