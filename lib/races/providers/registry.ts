import type { RaceDataProvider } from "@/lib/races/providers/base";
import { createActiveProvider } from "@/lib/races/providers/active";
import { createChronoTrackProvider } from "@/lib/races/providers/chronotrack";
import { createMockRaceProvider } from "@/lib/races/providers/mock";
import { createRaceResultProvider } from "@/lib/races/providers/raceresult";
import { createRunSignupProvider } from "@/lib/races/providers/runsignup";
import { createUtmbCatalogProvider } from "@/lib/races/providers/utmb-catalog";
import type { RaceIngestSource } from "@/lib/races/types/normalized";

function buildFactories(): (() => RaceDataProvider)[] {
  const list: (() => RaceDataProvider)[] = [
    createUtmbCatalogProvider,
    createActiveProvider,
    createRunSignupProvider,
    createChronoTrackProvider,
    createRaceResultProvider
  ];
  if (
    process.env.RACES_MOCK_PROVIDER === "1" ||
    process.env.NEXT_PUBLIC_RACES_INGEST_MOCK === "1"
  ) {
    list.push(createMockRaceProvider);
  }
  return list;
}

let cached: RaceDataProvider[] | null = null;

export function getAllRaceProviders(): RaceDataProvider[] {
  if (!cached) {
    cached = buildFactories().map((f) => f());
  }
  return cached;
}

export function getRaceProvider(id: RaceIngestSource): RaceDataProvider | undefined {
  return getAllRaceProviders().find((p) => p.id === id);
}

export function resolveProviders(filter?: RaceIngestSource[]): RaceDataProvider[] {
  const all = getAllRaceProviders();
  if (!filter?.length) return all;
  const set = new Set(filter);
  return all.filter((p) => set.has(p.id));
}
