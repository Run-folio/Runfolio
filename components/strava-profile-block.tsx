import type { StravaFeedActivity, StravaFeedStats } from "@/types";
import { StravaRecentActivitiesSection } from "@/components/strava-recent-activities-section";

type Props = {
  activities: StravaFeedActivity[];
  stats: StravaFeedStats;
  stravaOAuthConfigured?: boolean;
};

/** Owner-only block on public profile — real Strava data when you view your own URL. */
export function StravaProfileBlock({ activities, stats, stravaOAuthConfigured }: Props) {
  return (
    <div className="border-x border-b border-border bg-[#080a0e] px-5 py-8 md:px-8 md:py-10">
      <StravaRecentActivitiesSection
        activities={activities}
        stats={stats}
        title="My Strava activities"
        eyebrow="Live sync"
        limit={6}
        stravaOAuthConfigured={stravaOAuthConfigured}
        emptyHint="Connect Strava from Add race to show your activities on your public profile."
      />
    </div>
  );
}
