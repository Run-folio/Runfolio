import Link from "next/link";
import type { StravaFeedActivity, StravaFeedStats } from "@/types";
import { StravaActivityCard } from "@/components/strava-activity-card";
import { StravaInsightsStrip } from "@/components/strava-insights-strip";
import { Card } from "@/components/ui/card";

type Props = {
  activities: StravaFeedActivity[];
  stats: StravaFeedStats;
  title?: string;
  eyebrow?: string;
  limit?: number;
  showInsights?: boolean;
  stravaOAuthConfigured?: boolean;
  emptyHint?: string;
  /** Return path after Strava OAuth (must be signed in). */
  stravaOauthNext?: string;
};

export function StravaRecentActivitiesSection({
  activities,
  stats,
  title = "Recent activities",
  eyebrow = "Strava",
  limit = 8,
  showInsights = true,
  stravaOAuthConfigured = false,
  emptyHint,
  stravaOauthNext = "/dashboard"
}: Props) {
  const slice = activities.slice(0, limit);

  if (activities.length === 0) {
    return (
      <section>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="type-eyebrow">{eyebrow}</p>
            <h2 className="type-section mt-2 text-lg md:text-xl">{title}</h2>
          </div>
        </div>
        <Card className="border-dashed border-white/20 bg-panel/40 p-6 text-center">
          <p className="text-sm text-muted">
            {emptyHint ??
              "Connect Strava to see your real activities here. Until then, sample races stay in the highlights above."}
          </p>
          {stravaOAuthConfigured ? (
            <Link
              href={`/api/strava/oauth/start?next=${encodeURIComponent(stravaOauthNext)}`}
              className="mt-4 inline-block text-sm font-semibold uppercase tracking-wider text-accent hover:underline"
            >
              Connect Strava
            </Link>
          ) : null}
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="type-eyebrow">{eyebrow}</p>
          <h2 className="type-section mt-2 text-lg md:text-xl">{title}</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm">
            Newest first — pulled from your connected Strava account. Add a story on{" "}
            <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">
              Add race
            </Link>
            .
          </p>
        </div>
        <Link href="/races/new" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent hover:underline">
          Turn activity into race →
        </Link>
      </div>

      {showInsights ? <StravaInsightsStrip stats={stats} /> : null}

      {stats.topByDistance.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Longest efforts (top 3)</p>
          <div className="grid gap-3 md:grid-cols-3">
            {stats.topByDistance.map((a) => (
              <StravaActivityCard key={`top-${a.strava_id}`} activity={a} linkToPortfolio />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Recent</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {slice.map((a) => (
            <StravaActivityCard key={a.strava_id} activity={a} linkToPortfolio />
          ))}
        </div>
      </div>
    </section>
  );
}
