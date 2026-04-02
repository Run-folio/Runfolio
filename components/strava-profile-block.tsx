import type { StravaFeedStats, StravaRaceCandidate } from "@/types";
import { StravaRacePortfolioSection } from "@/components/strava-race-portfolio-section";

type Props = {
  raceCandidates: StravaRaceCandidate[];
  raceCandidateStats: StravaFeedStats;
  matchedMajorDiscoverIds: string[];
  stravaOAuthConfigured?: boolean;
  stravaOk: boolean;
};

/** Owner-only block on public profile — curated long-run feed when you view your own URL. */
export function StravaProfileBlock({
  raceCandidates,
  raceCandidateStats,
  matchedMajorDiscoverIds,
  stravaOAuthConfigured,
  stravaOk
}: Props) {
  return (
    <div className="border-x border-b border-border bg-[#080a0e] px-5 py-8 md:px-8 md:py-10">
      <StravaRacePortfolioSection
        candidates={raceCandidates}
        raceCandidateStats={raceCandidateStats}
        matchedMajorDiscoverIds={matchedMajorDiscoverIds}
        recentlyCompletedCatalog={[]}
        stravaOAuthConfigured={stravaOAuthConfigured}
        stravaOk={stravaOk}
        layout="profile"
      />
    </div>
  );
}
