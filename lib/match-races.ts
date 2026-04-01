import type { Race } from "@/types";

type MatchResult = {
  race: Race;
  confidence: number;
};

export function suggestRaceMatch(
  races: Race[],
  activityDistanceKm: number,
  activityDate: string
): MatchResult | null {
  const sourceDate = new Date(activityDate).getTime();
  const possibleMatches = races
    .filter((race) => race.distance_km && race.date)
    .map((race) => {
      const distanceDelta = Math.abs((race.distance_km ?? 0) - activityDistanceKm) / activityDistanceKm;
      const dateDelta = Math.abs(new Date(race.date ?? "").getTime() - sourceDate) / (1000 * 60 * 60 * 24);
      const withinDistance = distanceDelta <= 0.1;
      const withinDate = dateDelta <= 3;
      if (!withinDistance || !withinDate) return null;
      const confidence = Math.max(0, 1 - (distanceDelta * 0.7 + (dateDelta / 3) * 0.3));
      return { race, confidence };
    })
    .filter(Boolean) as MatchResult[];

  if (possibleMatches.length === 0) return null;
  return possibleMatches.sort((a, b) => b.confidence - a.confidence)[0];
}
