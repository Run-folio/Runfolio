import Link from "next/link";
import { CanonicalRaceDetailActions } from "@/components/canonical-race-detail/canonical-race-detail-actions";
import { formatRaceMonth } from "@/lib/format-race-date";
import {
  formatCanonicalDistanceKm,
  formatCanonicalElevation,
  formatCanonicalLocation,
  raceSurfaceLabel
} from "@/lib/races/canonical/detail-presentational";
import type { CanonicalRace } from "@/lib/races/canonical/types";
import type { fetchCanonicalRaceViewerState } from "@/lib/races/canonical/detail-user-state";
import { cn } from "@/lib/utils";

type Viewer = Awaited<ReturnType<typeof fetchCanonicalRaceViewerState>>;

function RaceHeroMedia({ race }: { race: CanonicalRace }) {
  const hero = race.heroImageUrl?.trim();
  const logo = race.logoUrl?.trim();
  if (hero) {
    return (
      <div className="relative aspect-[21/9] min-h-[200px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black md:aspect-[24/9] md:min-h-[280px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="h-full w-full object-cover" loading="eager" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/50 to-transparent" />
      </div>
    );
  }
  if (logo) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#2a1810] via-black to-[#0a1628] px-8 py-16 md:min-h-[240px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" className="max-h-36 w-auto max-w-[min(100%,420px)] object-contain" loading="eager" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex min-h-[200px] w-full items-center justify-center rounded-2xl border border-white/10",
        "bg-gradient-to-br from-[#3d2a1f] via-[#0a0a0f] to-[#0a1628] md:min-h-[260px]"
      )}
      aria-hidden
    >
      <span className="font-display text-5xl font-light tracking-tight text-white/20 md:text-6xl">
        {race.name.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-panel/40 px-5 py-4 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-normal text-white md:text-2xl">{value}</p>
    </div>
  );
}

/** Premium editorial layout for a verified canonical race (server-rendered shell + client actions). */
export function CanonicalRaceDetailView({
  race,
  viewer,
  urlRef
}: {
  race: CanonicalRace;
  viewer: Viewer | null;
  /** Raw `[raceId]` param (slug or uuid) for stable URIs. */
  urlRef: string;
}) {
  const locationLine = formatCanonicalLocation(race);
  const dateLine = race.startDate ? formatRaceMonth(race.startDate) : "";
  const shortDate = race.startDate ? race.startDate.slice(0, 10) : "";

  const bucketGoal = viewer?.bucketGoal ?? null;
  const primaryFinish = viewer?.primaryFinish ?? null;

  const lat = race.latitude;
  const lon = race.longitude;
  const mapHref =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`
      : null;
  const staticMapSrc =
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=11&size=900x320&markers=${lat},${lon},red-pushpin`
      : null;

  const tags = [...race.categoryTags].slice(0, 8);
  if (race.raceType && !tags.includes(race.raceType)) tags.unshift(race.raceType);

  return (
    <div className="min-h-screen bg-[#05070c]">
      <article className="app-shell mx-auto max-w-[1200px] px-5 pb-20 pt-10 md:px-8 md:pt-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/races/find" className="text-[13px] font-medium text-white/55 transition hover:text-white">
            ← Find a race
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent/90">Verified course</p>
        </div>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-14">
          <div className="space-y-10">
            <RaceHeroMedia race={race} />

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-normal leading-[1.08] tracking-tight text-white md:text-5xl lg:text-[3.25rem]">
                {race.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-white/70">
                {locationLine ? <span>{locationLine}</span> : <span className="text-muted">Location TBD</span>}
                {locationLine && (dateLine || shortDate) ? <span className="text-white/25">·</span> : null}
                {dateLine || shortDate ? (
                  <span>{dateLine || shortDate}</span>
                ) : (
                  <span className="text-muted">Date TBD</span>
                )}
              </div>
            </div>

            <section className="rounded-[20px] border border-white/10 bg-[#080a10] p-6 md:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">At a glance</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <StatCard label="Distance" value={formatCanonicalDistanceKm(race.distanceKm)} />
                <StatCard label="Elevation gain" value={formatCanonicalElevation(race.elevationGainM)} />
                <StatCard label="Surface" value={raceSurfaceLabel(race)} />
                <StatCard
                  label="Type"
                  value={
                    race.raceType?.trim() ||
                    (race.isUltra ? "Ultra" : race.isTrail ? "Trail" : race.isRoad ? "Road" : "—")
                  }
                />
              </div>
              {(race.utmbCategory?.trim() || race.utmbIndexEligible) && (
                <div className="mt-6 rounded-xl border border-gold/25 bg-gold/[0.04] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/90">UTMB World Series</p>
                  <p className="mt-1 text-sm text-white/85">
                    {race.utmbCategory?.trim() ?? "Index-eligible course"}
                    {race.utmbIndexEligible === true ? " · Eligible for index points" : null}
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">The course</h2>
              {race.description?.trim() ? (
                <div className="prose prose-invert max-w-none">
                  <p className="text-base leading-relaxed text-white/82 whitespace-pre-wrap">{race.description.trim()}</p>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-white/50">
                  We&apos;re still curating the full story for this event. Core stats above are verified; narrative copy
                  lands as editors enrich the catalog.
                </p>
              )}
              {(race.surfaceType?.trim() || tags.length > 0) && (
                <div className="pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Terrain & tags</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {race.surfaceType?.trim() ? (
                      <li className="rounded-md border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] text-white/75">
                        {race.surfaceType}
                      </li>
                    ) : null}
                    {tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-md border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-wide text-muted"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Start area</h2>
              {mapHref && staticMapSrc ? (
                <a href={mapHref} target="_blank" rel="noreferrer" className="group block">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14] transition group-hover:border-white/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={staticMapSrc}
                      alt=""
                      className="h-auto w-full object-cover opacity-95 transition duration-300 group-hover:scale-[1.01] group-hover:opacity-100"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/45">
                    Open full map — map data ©{" "}
                    <span className="text-white/55">OpenStreetMap</span> contributors
                  </p>
                </a>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/12 bg-panel/25 px-5 py-8 text-sm text-white/50">
                  {locationLine
                    ? "Approximate location is listed above; precise pins land when we ingest course data."
                    : "Location details are still light for this event — we only show maps when coordinates are verified."}
                </p>
              )}
            </section>

            <section className="rounded-[20px] border border-white/8 bg-gradient-to-b from-panel/30 to-transparent p-6 md:p-8">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Community</h2>
              <p className="type-meta mt-2 max-w-xl text-sm text-white/55">
                Runfolio-wide signals for this race will appear here — think shared bucket-list energy and finish lines
                linked from Strava.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-5 py-6">
                  <p className="font-display text-3xl text-white/90">—</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">On bucket lists</p>
                  <p className="mt-2 text-xs text-white/40">Aggregates coming soon</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-5 py-6">
                  <p className="font-display text-3xl text-white/90">—</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">Logged finishes</p>
                  <p className="mt-2 text-xs text-white/40">Aggregates coming soon</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-8 lg:pt-4">
            <div className="sticky top-6 space-y-8">
              <div className="rounded-[20px] border border-amber-500/25 bg-gradient-to-b from-[#1a1208]/90 to-[#0a0c10] p-6 shadow-lg shadow-black/40">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">Your journey</p>
                <p className="type-meta mt-3 text-sm leading-relaxed text-white/60">
                  Save this verified event, then mark it complete or attach Strava whenever you&apos;re ready.
                </p>
                <div className="mt-6">
                  <CanonicalRaceDetailActions
                    canonicalRaceId={race.id}
                    slug={race.slug}
                    authed={Boolean(viewer)}
                    bucketGoal={bucketGoal}
                    primaryFinish={primaryFinish}
                  />
                </div>
              </div>

              {(race.officialUrl?.trim() || race.registrationUrl?.trim() || race.organizerName?.trim()) && (
                <div className="rounded-2xl border border-white/10 bg-panel/35 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organizer</p>
                  {race.organizerName?.trim() ? (
                    <p className="mt-2 text-sm font-medium text-white">{race.organizerName.trim()}</p>
                  ) : null}
                  <ul className="mt-4 space-y-2 text-sm">
                    {race.officialUrl?.trim() ? (
                      <li>
                        <a
                          href={race.officialUrl.trim()}
                          className="text-accent underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Official site →
                        </a>
                      </li>
                    ) : null}
                    {race.registrationUrl?.trim() ? (
                      <li>
                        <a
                          href={race.registrationUrl.trim()}
                          className="text-accent underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Registration →
                        </a>
                      </li>
                    ) : null}
                  </ul>
                </div>
              )}

              <p className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-relaxed text-white/45">
                Share <span className="font-mono text-[11px] text-white/60">/races/{race.slug}</span>
                {urlRef !== race.slug ? (
                  <>
                    {" "}
                    <span className="text-white/30">·</span> alias <span className="font-mono text-white/55">{urlRef}</span>
                  </>
                ) : null}{" "}
                — stable URL for race week.
              </p>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
