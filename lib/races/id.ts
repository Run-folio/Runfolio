import type { RaceIngestSource } from "@/lib/races/types/normalized";

export function buildInternalRaceId(source: RaceIngestSource, sourceRaceId: string): string {
  return `${source}:${sourceRaceId}`;
}

export function parseInternalRaceId(internalId: string): { source: RaceIngestSource; sourceRaceId: string } | null {
  const idx = internalId.indexOf(":");
  if (idx <= 0 || idx === internalId.length - 1) return null;
  const source = internalId.slice(0, idx) as RaceIngestSource;
  const sourceRaceId = internalId.slice(idx + 1);
  const allowed: RaceIngestSource[] = [
    "active",
    "runsignup",
    "chronotrack",
    "utmb_catalog",
    "raceresult",
    "mock",
    "manual"
  ];
  if (!allowed.includes(source)) return null;
  return { source, sourceRaceId };
}
