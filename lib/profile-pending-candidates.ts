import { rankKnownRaceMatches } from "@/lib/known-race-match";
import {
  isConfirmedPortfolioCompletion,
  raceIncludedOnProfile
} from "@/lib/portfolio-race";
import { stravaFeedActivityToMatchInput } from "@/lib/strava-race-candidates";
import type { ProfilePendingRaceCandidate, Race, StravaRaceCandidate } from "@/types";

function activityCoversStravaForProfile(races: Race[], stravaId: string): boolean {
  for (const r of races) {
    if (r.strava_activity_id !== stravaId) continue;
    if (!r.is_completed || !isConfirmedPortfolioCompletion(r)) continue;
    if (raceIncludedOnProfile(r)) return true;
  }
  return false;
}

/**
 * Imported major Strava efforts that are not yet approved for the public portfolio,
 * excluding durable dismissals and activities already saved as profile-included finishes.
 */
export function buildProfilePendingRaceCandidates(
  enriched: StravaRaceCandidate[],
  allRaces: Race[],
  dismissedStravaIds: Set<string>
): ProfilePendingRaceCandidate[] {
  const out: ProfilePendingRaceCandidate[] = [];
  for (const c of enriched) {
    if (dismissedStravaIds.has(c.strava_id)) continue;
    if (activityCoversStravaForProfile(allRaces, c.strava_id)) continue;

    const input = stravaFeedActivityToMatchInput(c);
    const alternatives = rankKnownRaceMatches(input, allRaces, 0.26).slice(0, 8);
    const s = c.catalogSuggestion;

    out.push({
      stravaId: c.strava_id,
      activityTitle: c.name,
      date: input.date,
      distanceKm: c.distance_km,
      elevationM: c.elevation_m,
      movingTimeLabel: c.moving_time_label,
      location: [c.location_city, c.location_country].filter(Boolean).join(", "),
      sportType: c.sport_type,
      activityType: c.type,
      suggestedDiscoverId: s?.discoverRaceId ?? null,
      suggestedDisplayTitle: s ? s.displayTitle : null,
      confidence: s?.confidence ?? null,
      score: s?.score ?? 0,
      reasons: s?.reasons ?? [],
      onUserBucketList: s?.onUserBucketList ?? false,
      userRaceId: s?.userRaceId ?? null,
      alternatives
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
