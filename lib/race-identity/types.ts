import type { Race } from "@/types";

/** Structured runner traits from published, confirmed race rows only. */
export type RunnerRaceIdentity = {
  sourceRaceCount: number;
  marathonFinishes: number;
  ultraFinishes: number;
  /** Finishes at catalog distances ≥ 100 km. */
  hundredKmPlusFinishes: number;
  worldMajorFinishes: number;
  /** Distinct Abbott majors in set (max 6). */
  worldMajorDistinct: number;
  utmbSeriesFinishes: number;
  distinctUtmbSeriesRaceIds: string[];
  longestDistanceKm: number | null;
  longestDistanceRace: Pick<Race, "id" | "name" | "date"> | null;
  maxElevationGainM: number | null;
  maxElevationRace: Pick<Race, "id" | "name" | "date"> | null;
  totalElevationM: number;
  /** Lowercased country tokens from `location` (same heuristic as stats). */
  countriesRaced: string[];
  fastestMarathonSeconds: number | null;
  fastestMarathonRace: Pick<Race, "id" | "name" | "date" | "time"> | null;
};

export type AchievementTier = "gold" | "silver" | "bronze";

export type RunnerAchievement = {
  id: string;
  title: string;
  subtitle: string;
  tier: AchievementTier;
  /** Higher sorts first within tier. */
  sortWeight: number;
  earnedAt: string | null;
};

export type RunnerIdentityPresentation = {
  headline: string;
  supportingLine: string;
  archetype: "ultra" | "marathon" | "mixed" | "explorer";
};
