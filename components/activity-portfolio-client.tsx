"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ActivityPortfolioStravaView, Race } from "@/types";
import { upsertActivityPortfolioAction } from "@/lib/actions";
import { discoverRaces } from "@/lib/discover-races";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { getDiscoverPrestigeMeta } from "@/lib/discover-race-prestige";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  stravaView: ActivityPortfolioStravaView;
  race: Race | null;
  suggestedDiscoverRaceId: string | null;
  catalogDisplayTitle: string | null;
  stravaFetchFailed: boolean;
  bucketListGoalActive: boolean;
};

function mergePhotoUrls(strava: string[], manual: string[] | null | undefined): string[] {
  const m = manual ?? [];
  return [...new Set([...strava, ...m].filter(Boolean))];
}

function strOrFallback(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  if (v) return v;
  return fallback;
}

export function ActivityPortfolioClient({
  stravaView,
  race,
  suggestedDiscoverRaceId,
  catalogDisplayTitle,
  stravaFetchFailed,
  bucketListGoalActive
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!race);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveDiscoverId = race?.discover_race_id ?? suggestedDiscoverRaceId;
  const prestige = getDiscoverPrestigeMeta(effectiveDiscoverId);
  const displayTitle = race ? getPortfolioRaceLabel(race) : stravaView.name;
  const photos = useMemo(
    () => mergePhotoUrls(stravaView.photo_urls, race?.manual_photo_urls),
    [stravaView.photo_urls, race?.manual_photo_urls]
  );
  const heroScene = getRaceSceneImagePath(displayTitle);
  const sportLabel = stravaView.sport_type || stravaView.type || "Run";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setErr(null);
      const res = await upsertActivityPortfolioAction(fd);
      if (res && "error" in res && res.error) {
        setErr(res.error);
        return;
      }
      router.refresh();
      setEditing(false);
    });
  }

  const statGrid = [
    { label: "Distance", value: `${stravaView.distance_km} km` },
    { label: "Moving time", value: stravaView.moving_time_label },
    {
      label: "Elapsed",
      value: stravaView.elapsed_time_label ?? "—"
    },
    { label: "Pace", value: stravaView.pace_label ?? "—" },
    { label: "Elevation", value: stravaView.elevation_m != null ? `${stravaView.elevation_m} m` : "—" },
    { label: "Location", value: stravaView.location_label },
    { label: "Kudos", value: String(stravaView.kudos_count) },
    { label: "Achievements", value: String(stravaView.achievement_count) }
  ];

  return (
    <>
      <section className="relative min-h-[320px] overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- Strava CDN URLs; avoid remotePatterns setup
            <img src={photos[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src={heroScene} alt="" fill className="object-cover" sizes="100vw" priority />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/30" />
        <div className="relative z-10 mx-auto flex min-h-[320px] max-w-5xl flex-col justify-end px-5 pb-10 pt-24 md:px-8">
          <Link
            href="/dashboard"
            className="mb-6 w-fit text-[13px] font-medium text-white/70 transition hover:text-white"
          >
            ← Back
          </Link>
          <p className="type-tagline mb-2 text-accent">Race portfolio</p>
          <h1 className="type-display max-w-4xl text-white">{displayTitle}</h1>
          {race?.race_subtitle ? (
            <p className="mt-3 max-w-2xl text-lg text-white/85">{race.race_subtitle}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="border border-white/20 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90">
              {sportLabel}
            </span>
            <span className="text-sm tabular-nums text-white/75">{stravaView.start_date}</span>
            {stravaFetchFailed ? (
              <span className="border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                Saved copy · live Strava unavailable
              </span>
            ) : null}
            {prestige?.is_major_marathon ? (
              <span className="border border-gold/45 bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                Major marathon
              </span>
            ) : null}
            {prestige?.is_utmb_series ? (
              <span className="border border-accent/45 bg-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                UTMB series
              </span>
            ) : null}
            {race?.tag_bucket_list_done ? (
              <span className="border border-green-500/45 bg-green-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-300">
                Bucket list done
              </span>
            ) : null}
            {bucketListGoalActive && !race?.tag_bucket_list_done ? (
              <span className="border border-white/25 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                On your bucket list
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={stravaView.strava_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center border border-white/25 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:border-accent/50 hover:text-accent"
            >
              Open in Strava
            </a>
            {effectiveDiscoverId ? (
              <Link
                href={`/races/${effectiveDiscoverId}`}
                className="inline-flex items-center border border-accent/40 bg-accent/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent transition hover:bg-accent/25"
              >
                {getCatalogDisplayTitle(effectiveDiscoverId)} · catalog
              </Link>
            ) : catalogDisplayTitle ? (
              <span className="inline-flex items-center border border-white/15 bg-black/40 px-4 py-2 text-[11px] text-white/60">
                Suggested: {catalogDisplayTitle}
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="border border-white/30 bg-transparent text-[11px] font-semibold uppercase tracking-[0.15em] hover:bg-white/10"
              onClick={() => {
                setEditing((v) => !v);
                setErr(null);
              }}
            >
              {editing ? "View page" : "Edit story"}
            </Button>
          </div>
        </div>
      </section>

      <main className="app-shell space-y-12 pb-20 pt-10">
        {err ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</p>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">From Strava</h2>
          <Card className="border-white/10 bg-[#0a0a0a] p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statGrid.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{label}</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>
            {stravaView.description ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Strava description</p>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                  {stravaView.description}
                </p>
              </div>
            ) : null}
            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Route</p>
              {stravaView.has_map ? (
                <p className="mt-2 text-sm text-white/75">
                  Map data is available on Strava.{" "}
                  <a href={stravaView.strava_url} className="font-semibold text-accent underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                    View the route →
                  </a>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">No route preview in this import.</p>
              )}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Gallery</h2>
            <p className="max-w-xl text-xs text-muted">
              Strava often returns a single primary image per activity. Add image URLs below to build a fuller album.
            </p>
          </div>
          {photos.length === 0 ? (
            <Card className="overflow-hidden border border-dashed border-white/15 bg-[#0a0a0a]">
              <div className="relative aspect-[2.2/1] max-h-52 w-full border-b border-white/10">
                <Image src={heroScene} alt="" fill className="object-cover opacity-35 saturate-50" sizes="(max-width:768px) 100vw, 896px" />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/85 via-black/45 to-black/25 px-6 text-center">
                  <p className="text-sm font-medium text-white/90">No Strava images returned for this activity</p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-white/55">
                    The API often exposes only a primary shot, or none. Your hero uses course art until you add photos.
                  </p>
                </div>
              </div>
              <div className="p-8 text-center">
                <p className="text-sm text-white/70">
                  Add your own images: open <strong className="text-white/90">Edit story</strong> and paste HTTPS links
                  (one per line).
                </p>
              </div>
            </Card>
          ) : photos.length === 1 ? (
            <figure className="mx-auto max-w-3xl border border-white/12 bg-gradient-to-b from-white/[0.05] to-transparent p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-4">
              <div className="relative aspect-[16/9] overflow-hidden border border-white/10 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-3 border border-gold/20 md:inset-4" aria-hidden />
              </div>
              <figcaption className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
                Primary from Strava · add more in Edit story
              </figcaption>
            </figure>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className={cn(
                    "relative overflow-hidden border border-white/10 bg-black/40",
                    i === 0 ? "min-h-[240px] sm:col-span-2 sm:row-span-2" : "aspect-[4/3]"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Your race story</h2>
          {!editing ? (
            <div className="space-y-6">
              {race?.tag_pb ||
              race?.tag_career_highlight ||
              race?.tag_hardest ||
              race?.tag_bucket_list_done ? (
                <div className="flex flex-wrap gap-2">
                  {race.tag_pb ? (
                    <span className="border border-accent/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      PB
                    </span>
                  ) : null}
                  {race.tag_career_highlight ? (
                    <span className="border border-gold/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                      Career highlight
                    </span>
                  ) : null}
                  {race.tag_hardest ? (
                    <span className="border border-red-400/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-200">
                      Hardest race
                    </span>
                  ) : null}
                  {race.tag_bucket_list_done ? (
                    <span className="border border-green-500/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-300">
                      Bucket list completed
                    </span>
                  ) : null}
                </div>
              ) : null}
              {race?.description ? (
                <Card className="border-white/10 bg-[#0d0d0d] p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Full story</p>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">{race.description}</p>
                </Card>
              ) : (
                <p className="text-sm text-muted">No story yet — open edit to add reflections.</p>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: "Toughest moment", v: race?.reflection_toughest },
                  { label: "What I learned", v: race?.reflection_learned },
                  { label: "Why it mattered", v: race?.reflection_mattered }
                ].map(({ label, v }) =>
                  v ? (
                    <Card key={label} className="border-white/10 bg-[#0a0a0a] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/85">{v}</p>
                    </Card>
                  ) : null
                )}
              </div>
              {race?.finish_notes ? (
                <Card className="border-white/10 bg-[#0a0a0a] p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Finish / placement notes</p>
                  <p className="mt-2 text-sm text-white/85">{race.finish_notes}</p>
                </Card>
              ) : null}
            </div>
          ) : (
            <Card className="border-white/10 bg-[#0a0a0a] p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <input type="hidden" name="strava_activity_id" value={stravaView.strava_id} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Race title</label>
                    <Input
                      name="name"
                      required
                      defaultValue={strOrFallback(race?.name, stravaView.name)}
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Subtitle</label>
                    <Input
                      name="race_subtitle"
                      defaultValue={race?.race_subtitle ?? ""}
                      placeholder="Short line under the title"
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Linked catalog race</label>
                    <select
                      name="discover_race_id"
                      defaultValue={effectiveDiscoverId ?? ""}
                      className="mt-2 flex h-10 w-full border border-white/15 bg-black/50 px-3 text-sm text-white"
                    >
                      <option value="">— None / custom —</option>
                      {discoverRaces.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Date</label>
                    <Input
                      name="date"
                      type="date"
                      defaultValue={strOrFallback(race?.date, stravaView.start_date)}
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Location</label>
                    <Input
                      name="location"
                      defaultValue={strOrFallback(race?.location, stravaView.location_label)}
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Distance (km)</label>
                    <Input
                      name="distance_km"
                      type="number"
                      step="0.1"
                      defaultValue={race?.distance_km ?? stravaView.distance_km}
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Elevation (m)</label>
                    <Input
                      name="elevation_m"
                      type="number"
                      defaultValue={race?.elevation_m ?? stravaView.elevation_m ?? ""}
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Moving time</label>
                    <Input
                      name="time"
                      defaultValue={strOrFallback(race?.time, stravaView.moving_time_label)}
                      placeholder="e.g. 03:42:10"
                      className="mt-2 border-white/15 bg-black/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Full story / reflection</label>
                  <textarea
                    name="description"
                    rows={6}
                    defaultValue={race?.description ?? ""}
                    className="mt-2 w-full border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-muted"
                    placeholder="The narrative you want on your portfolio…"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(
                    [
                      ["reflection_toughest", "Toughest moment", race?.reflection_toughest],
                      ["reflection_learned", "What I learned", race?.reflection_learned],
                      ["reflection_mattered", "Why it mattered", race?.reflection_mattered]
                    ] as const
                  ).map(([name, label, def]) => (
                    <div key={name}>
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</label>
                      <textarea
                        name={name}
                        rows={4}
                        defaultValue={def ?? ""}
                        className="mt-2 w-full border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                    Finish / placement notes
                  </label>
                  <textarea
                    name="finish_notes"
                    rows={3}
                    defaultValue={race?.finish_notes ?? ""}
                    className="mt-2 w-full border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                    placeholder="Age group, splits, what the watch missed…"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                    Extra photo URLs (one HTTPS URL per line)
                  </label>
                  <textarea
                    name="manual_photo_urls"
                    rows={4}
                    defaultValue={(race?.manual_photo_urls ?? []).join("\n")}
                    className="mt-2 w-full border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                    placeholder="https://…"
                  />
                </div>

                <fieldset className="space-y-2 border border-white/10 p-4">
                  <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Tags</legend>
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input type="checkbox" name="tag_pb" defaultChecked={race?.tag_pb} className="accent-accent" />
                    PB
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input
                      type="checkbox"
                      name="tag_career_highlight"
                      defaultChecked={race?.tag_career_highlight}
                      className="accent-accent"
                    />
                    Career highlight
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input type="checkbox" name="tag_hardest" defaultChecked={race?.tag_hardest} className="accent-accent" />
                    Hardest race
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input
                      type="checkbox"
                      name="tag_bucket_list_done"
                      defaultChecked={race?.tag_bucket_list_done}
                      className="accent-accent"
                    />
                    Bucket list completed
                  </label>
                </fieldset>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={pending} className="bg-accent text-black hover:bg-accent/90">
                    {pending ? "Saving…" : "Save portfolio"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
