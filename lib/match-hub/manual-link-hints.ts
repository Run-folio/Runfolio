import {
  CANONICAL_MANUAL_HINT_MAX,
  CANONICAL_MANUAL_HINT_MIN_SCORE,
  CANONICAL_SUGGESTED_HIGH_MIN_SCORE
} from "@/lib/strava-canonical-match/match-policy";
import type { CanonicalStravaRaceMatch } from "@/lib/strava-canonical-match/suggestions";

export type ManualRaceSoftHint = {
  canonicalRaceId: string;
  name: string;
  score: number;
  subtitle: string;
  seriesId: string | null;
};

/** Sub-threshold ranked matches for manual-link UI (date/geo/distance–aware, not noisy). */
export function buildManualRaceSoftHints(ranked: CanonicalStravaRaceMatch[]): ManualRaceSoftHint[] {
  return ranked
    .filter((r) => r.score >= CANONICAL_MANUAL_HINT_MIN_SCORE && r.score < CANONICAL_SUGGESTED_HIGH_MIN_SCORE)
    .slice(0, CANONICAL_MANUAL_HINT_MAX)
    .map((r) => ({
      canonicalRaceId: r.canonicalRaceId,
      name: r.name,
      score: r.score,
      subtitle: r.subtitle,
      seriesId: r.seriesId
    }));
}
