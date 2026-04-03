import { describe, expect, it } from "vitest";
import { buildManualRaceSoftHints } from "@/lib/match-hub/manual-link-hints";
import type { CanonicalStravaRaceMatch } from "@/lib/strava-canonical-match/suggestions";

function mockMatch(score: number): CanonicalStravaRaceMatch {
  return {
    canonicalRaceId: `id-${score}`,
    seriesId: null,
    name: "Test",
    slug: "test",
    confidence: "medium",
    score,
    breakdown: {} as CanonicalStravaRaceMatch["breakdown"],
    subtitle: "why"
  };
}

describe("buildManualRaceSoftHints", () => {
  it("keeps scores in the manual band only", () => {
    const ranked = [mockMatch(85), mockMatch(70), mockMatch(55), mockMatch(40)];
    const hints = buildManualRaceSoftHints(ranked);
    expect(hints.map((h) => h.score)).toEqual([70, 55]);
  });
});
