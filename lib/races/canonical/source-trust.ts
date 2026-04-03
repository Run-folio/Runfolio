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
  active: 82,
  runsignup: 78,
  chronotrack: 65,
  utmb_catalog: 72,
  manual: 95,
  mock: 10
};

export function sourceTrustRank(source: RaceIngestSource): number {
  return TRUST_RANK[source] ?? 50;
}

/** Ordered list for docs / admin tooling */
export function listSourceTrustOrder(): RaceIngestSource[] {
  return (Object.keys(TRUST_RANK) as RaceIngestSource[]).sort((a, b) => TRUST_RANK[b]! - TRUST_RANK[a]!);
}
