import type { CanonicalRace } from "@/lib/races/canonical/types";

function joinLoc(r: Pick<CanonicalRace, "city" | "region" | "country">): string | null {
  const p = [r.city, r.region, r.country].filter((x) => x?.trim());
  return p.length ? p.join(", ") : null;
}

function surfacePhrase(r: Pick<CanonicalRace, "surfaceType" | "isTrail" | "isRoad" | "isUltra">): string {
  if (r.isUltra) return "ultra-distance";
  if (r.isTrail || r.surfaceType?.toLowerCase().includes("trail")) return "trail";
  if (r.isRoad || r.surfaceType?.toLowerCase().includes("road")) return "road";
  if (r.surfaceType?.trim()) return r.surfaceType.trim().toLowerCase();
  return "running";
}

function distancePhrase(km: number | null): string | null {
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  const rounded = km >= 20 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded} km`;
}

/**
 * Short, factual blurb when editorial copy is missing — no LLM; safe at scale.
 */
export function synthesizeRaceSummary(race: CanonicalRace): string {
  const loc = joinLoc(race);
  const dist = distancePhrase(race.distanceKm);
  const surface = surfacePhrase(race);
  const parts: string[] = [];
  parts.push(race.name.trim());
  if (dist) parts.push(`${dist} ${surface} event`);
  else parts.push(`${surface} event`);
  if (race.startDate?.trim()) {
    const ymd = race.startDate.slice(0, 10);
    if (ymd.length === 10) parts.push(`typically held around ${ymd}`);
  }
  if (loc) parts.push(`in ${loc}`);
  if (race.elevationGainM != null && race.elevationGainM > 200) {
    parts.push(`with roughly ${Math.round(race.elevationGainM)} m of climbing`);
  }
  let s = parts.join(" — ").replace(/\s+/g, " ").trim();
  if (s.length > 320) s = `${s.slice(0, 317)}…`;
  return s;
}
