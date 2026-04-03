import type { RunnerAchievement, RunnerIdentityPresentation, RunnerRaceIdentity } from "@/lib/race-identity/types";
import { cn } from "@/lib/utils";

function TierGlow({ tier }: { tier: RunnerAchievement["tier"] }) {
  if (tier === "gold") {
    return "border-amber-400/35 bg-gradient-to-br from-amber-500/[0.12] via-[#0c0e12] to-[#06080c] shadow-[0_0_24px_rgba(234,179,8,0.08)]";
  }
  if (tier === "silver") {
    return "border-slate-400/30 bg-gradient-to-br from-slate-400/[0.08] to-[#06080c]";
  }
  return "border-orange-200/20 bg-gradient-to-br from-orange-200/[0.06] to-[#06080c]";
}

function AchievementCard({
  achievement,
  featured
}: {
  achievement: RunnerAchievement;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border px-4 py-3",
        TierGlow({ tier: achievement.tier }),
        featured && "md:px-5 md:py-4"
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{achievement.tier}</p>
      <h3 className={cn("mt-1.5 font-display font-normal text-white", featured ? "text-lg md:text-xl" : "text-base")}>
        {achievement.title}
      </h3>
      <p className="mt-1 text-[12px] leading-snug text-white/55">{achievement.subtitle}</p>
      {achievement.earnedAt ? (
        <p className="mt-2 text-[10px] uppercase tracking-wider text-white/35">{achievement.earnedAt}</p>
      ) : null}
    </article>
  );
}

export function RunningProfileRaceIdentitySection({
  presentation,
  identity,
  achievements,
  showWhenEmpty
}: {
  presentation: RunnerIdentityPresentation;
  identity: RunnerRaceIdentity;
  achievements: RunnerAchievement[];
  /** Owner preview before first publish */
  showWhenEmpty?: boolean;
}) {
  const hasSignal =
    identity.sourceRaceCount > 0 ||
    achievements.length > 0 ||
    identity.worldMajorDistinct > 0 ||
    identity.countriesRaced.length > 0;

  if (!hasSignal && !showWhenEmpty) return null;

  const top = achievements.slice(0, 3);
  const rest = achievements.slice(3);

  return (
    <div className="border-x border-b border-border bg-[#070910]">
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8 md:py-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent/90">Runner story</p>
        <h2 className="font-display mt-4 text-3xl font-normal tracking-tight text-white md:text-4xl">
          {presentation.headline}
        </h2>
        <p className="type-meta mt-3 max-w-2xl text-base leading-relaxed text-white/65">{presentation.supportingLine}</p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Marathons</dt>
            <dd className="mt-1 font-display text-2xl text-white">{identity.marathonFinishes}</dd>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ultras (50 km+)</dt>
            <dd className="mt-1 font-display text-2xl text-white">{identity.ultraFinishes}</dd>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">World Majors</dt>
            <dd className="mt-1 font-display text-2xl text-white">
              {identity.worldMajorDistinct}/6
              <span className="ml-2 text-xs font-sans font-normal text-white/45">{identity.worldMajorFinishes} finishes</span>
            </dd>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">UTMB Series</dt>
            <dd className="mt-1 font-display text-2xl text-white">{identity.utmbSeriesFinishes}</dd>
          </div>
        </dl>

        {(identity.longestDistanceKm != null && identity.longestDistanceKm > 0) ||
        identity.maxElevationGainM != null ||
        identity.countriesRaced.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-white/70">
            {identity.longestDistanceKm != null && identity.longestDistanceKm > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                Longest: <strong className="text-white">{identity.longestDistanceKm} km</strong>
                {identity.longestDistanceRace?.name ? (
                  <span className="text-white/50"> · {identity.longestDistanceRace.name}</span>
                ) : null}
              </span>
            ) : null}
            {identity.maxElevationGainM != null && identity.maxElevationGainM > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                Max climb: <strong className="text-white">{identity.maxElevationGainM} m</strong>
              </span>
            ) : null}
            {identity.countriesRaced.length > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                Raced in: <strong className="text-white">{identity.countriesRaced.length}</strong>
              </span>
            ) : null}
          </div>
        ) : null}

        {achievements.length > 0 ? (
          <div className="mt-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Achievements</p>
            <p className="type-meta mt-2 max-w-xl text-sm text-white/50">
              Earned from published, catalog-backed finishes only — not generic Strava streaks.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {top.map((a) => (
                <AchievementCard key={a.id} achievement={a} featured />
              ))}
            </div>
            {rest.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </div>
            ) : null}
          </div>
        ) : hasSignal ? (
          <p className="type-meta mt-10 text-sm text-white/45">
            Keep publishing iconic finishes — achievements unlock from milestones like majors, 100 km races, and UTMB
            Series depth.
          </p>
        ) : null}
      </div>
    </div>
  );
}
