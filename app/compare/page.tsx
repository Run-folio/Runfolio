import Link from "next/link";
import type { Metadata } from "next";
import { AppNavbar } from "@/components/app-navbar";
import { DataBackendSetupGate } from "@/components/data-backend-setup-gate";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { sharedCatalogFinishes } from "@/lib/race-identity/compare-runners";
import {
  buildRunnerIdentityPresentation,
  deriveRunnerAchievements,
  deriveRunnerRaceIdentity
} from "@/lib/race-identity/derive";
import { profileApprovedCompletedRaces } from "@/lib/portfolio-race";
import { fetchPublicProfileBundle } from "@/lib/supabase/fetch-public-profile";
import { computeRunningProfileStats } from "@/lib/running-profile/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare runners · Runfolio",
  description: "Race-linked comparison: shared finishes, distances, and achievements — no social feed."
};

type Props = {
  searchParams: Promise<{ a?: string; b?: string }>;
};

export default async function CompareRunnersPage({ searchParams }: Props) {
  if (!isSupabaseConfigured()) {
    return (
      <DataBackendSetupGate title="Compare runners" featureLabel="Runner comparison" returnTo="/compare" />
    );
  }

  const sp = await searchParams;
  const rawA = decodeURIComponent(sp.a?.trim() ?? "").trim();
  const rawB = decodeURIComponent(sp.b?.trim() ?? "").trim();

  const hasPair = rawA.length > 0 && rawB.length > 0;
  const bundleA = hasPair ? await fetchPublicProfileBundle(rawA) : null;
  const bundleB = hasPair ? await fetchPublicProfileBundle(rawB) : null;

  const publicA = Boolean(bundleA?.runner && bundleA.runner.profile_public !== false);
  const publicB = Boolean(bundleB?.runner && bundleB.runner.profile_public !== false);

  const racesA = publicA ? profileApprovedCompletedRaces(bundleA!.races ?? []) : [];
  const racesB = publicB ? profileApprovedCompletedRaces(bundleB!.races ?? []) : [];

  const identityA = publicA ? deriveRunnerRaceIdentity(racesA) : null;
  const identityB = publicB ? deriveRunnerRaceIdentity(racesB) : null;
  const achievementsA = publicA && identityA ? deriveRunnerAchievements(racesA, identityA) : [];
  const achievementsB = publicB && identityB ? deriveRunnerAchievements(racesB, identityB) : [];
  const presentationA = identityA ? buildRunnerIdentityPresentation(identityA) : null;
  const presentationB = identityB ? buildRunnerIdentityPresentation(identityB) : null;
  const statsA = publicA ? computeRunningProfileStats(racesA) : null;
  const statsB = publicB ? computeRunningProfileStats(racesB) : null;
  const shared =
    publicA && publicB ? sharedCatalogFinishes(racesA, racesB) : [];

  const slugA = rawA ? encodeURIComponent(bundleA?.runner?.name ?? rawA) : "";
  const slugB = rawB ? encodeURIComponent(bundleB?.runner?.name ?? rawB) : "";

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <header className="border-b border-white/10 bg-[#070a10] px-5 py-10 md:px-8 md:py-12">
          <div className="app-shell mx-auto max-w-[1100px]">
            <p className="type-eyebrow">Race-first · No feed</p>
            <h1 className="font-display mt-3 text-3xl font-normal tracking-tight text-white md:text-4xl">
              Compare runners
            </h1>
            <p className="type-meta mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
              Side-by-side view of published finishes, catalog overlap, and milestone badges — all derived from confirmed
              races on Runfolio.
            </p>

            <form className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end" method="get" action="/compare">
              <label className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                Runner A (profile name)
                <input
                  name="a"
                  defaultValue={rawA}
                  placeholder="e.g. Alex Runner"
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
                />
              </label>
              <label className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                Runner B (profile name)
                <input
                  name="b"
                  defaultValue={rawB}
                  placeholder="e.g. Sam Speed"
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
                />
              </label>
              <button
                type="submit"
                className="rounded-xl border border-accent/50 bg-accent/15 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-accent transition hover:bg-accent/25"
              >
                Compare
              </button>
            </form>
          </div>
        </header>

        <div className="app-shell mx-auto max-w-[1100px] space-y-10 px-5 py-10 md:px-8">
          {!hasPair ? (
            <p className="type-meta text-sm text-white/50">
              Enter two public profile names exactly as they appear in the URL bar{" "}
              <span className="text-white/65">(e.g. /Alex%20Thompson)</span>.
            </p>
          ) : rawA.toLowerCase() === rawB.toLowerCase() ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
              Pick two different runners to compare.
            </p>
          ) : (
            <>
              <section className="grid gap-6 md:grid-cols-2">
                <RunnerCompareCard
                  label="Runner A"
                  name={bundleA?.runner?.name ?? rawA}
                  href={slugA ? `/${slugA}` : null}
                  publicProfile={publicA}
                  presentation={presentationA}
                  stats={statsA}
                  achievementCount={achievementsA.length}
                  identity={identityA}
                />
                <RunnerCompareCard
                  label="Runner B"
                  name={bundleB?.runner?.name ?? rawB}
                  href={slugB ? `/${slugB}` : null}
                  publicProfile={publicB}
                  presentation={presentationB}
                  stats={statsB}
                  achievementCount={achievementsB.length}
                  identity={identityB}
                />
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#080b12] p-6 md:p-8">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Shared catalog races</h2>
                <p className="type-meta mt-2 text-sm text-white/55">
                  Same discover or canonical link on both profiles (published finishes).
                </p>
                {shared.length === 0 ? (
                  <p className="mt-6 text-sm text-white/45">No overlapping catalog finishes yet.</p>
                ) : (
                  <ul className="mt-6 space-y-2">
                    {shared.map((s) => (
                      <li
                        key={s.key}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 pb-2 text-sm text-white/85 last:border-0"
                      >
                        <span className="font-medium text-white">{s.raceNameA}</span>
                        <span className="text-[11px] text-white/40">{s.key.startsWith("disc:") ? "Catalog" : "Verified"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <AchievementList title="Achievements · A" achievements={achievementsA} />
                <AchievementList title="Achievements · B" achievements={achievementsB} />
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function RunnerCompareCard({
  label,
  name,
  href,
  publicProfile,
  presentation,
  stats,
  achievementCount,
  identity
}: {
  label: string;
  name: string;
  href: string | null;
  publicProfile: boolean;
  presentation: ReturnType<typeof buildRunnerIdentityPresentation> | null;
  stats: ReturnType<typeof computeRunningProfileStats> | null;
  achievementCount: number;
  identity: ReturnType<typeof deriveRunnerRaceIdentity> | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-panel/40 to-[#06080c] p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">{label}</p>
      <h3 className="mt-2 font-display text-2xl text-white">{name}</h3>
      {href ? (
        <Link href={href} className="mt-2 inline-block text-[12px] font-semibold text-gold hover:underline">
          Open profile →
        </Link>
      ) : null}
      {!publicProfile ? (
        <p className="mt-4 text-sm text-white/50">Profile private or runner not found.</p>
      ) : presentation && stats && identity ? (
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Story</dt>
            <dd className="mt-1 text-white/80">{presentation.supportingLine}</dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Distance</dt>
              <dd className="mt-1 font-semibold text-white">{stats.totalDistanceKm} km</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Climb</dt>
              <dd className="mt-1 font-semibold text-white">{stats.totalElevationM} m</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Majors</dt>
              <dd className="mt-1 font-semibold text-white">
                {identity.worldMajorDistinct}/6
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Achievements</dt>
              <dd className="mt-1 font-semibold text-white">{achievementCount}</dd>
            </div>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function AchievementList({
  title,
  achievements
}: {
  title: string;
  achievements: ReturnType<typeof deriveRunnerAchievements>;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#070910] p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{title}</h3>
      {achievements.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">No milestone badges yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {achievements.slice(0, 12).map((a) => (
            <li key={a.id} className="border-b border-white/5 pb-2 text-sm last:border-0">
              <span className="font-medium text-white">{a.title}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-white/35">{a.tier}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
