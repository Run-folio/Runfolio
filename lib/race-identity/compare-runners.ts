import type { Race } from "@/types";

/** Stable key for catalog-linked published finishes (discover or canonical). */
export function raceCatalogKey(race: Race): string | null {
  const d = race.discover_race_id?.trim();
  if (d) return `disc:${d}`;
  const c = race.canonical_race_id?.trim();
  if (c) return `canon:${c}`;
  return null;
}

/** Published races that share the same discover or canonical id across two portfolios. */
export function sharedCatalogFinishes(profileRacesA: Race[], profileRacesB: Race[]): {
  key: string;
  raceNameA: string;
  raceNameB: string;
}[] {
  const mapA = new Map<string, Race>();
  for (const r of profileRacesA) {
    const k = raceCatalogKey(r);
    if (k && !mapA.has(k)) mapA.set(k, r);
  }
  const out: { key: string; raceNameA: string; raceNameB: string }[] = [];
  for (const r of profileRacesB) {
    const k = raceCatalogKey(r);
    if (!k) continue;
    const a = mapA.get(k);
    if (a) {
      out.push({ key: k, raceNameA: a.name, raceNameB: r.name });
    }
  }
  out.sort((x, y) => x.raceNameA.localeCompare(y.raceNameA));
  return out;
}
