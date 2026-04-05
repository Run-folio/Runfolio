"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ActivityPortfolioStravaEnrichment, ActivityPortfolioStravaView, Race } from "@/types";
import {
  markStravaActivityNotRaceAction,
  patchActivityPortfolioAction,
  snoozeStravaActivityMatchHubAction,
  type ActivityPortfolioPatch
} from "@/lib/actions";
import type { ManualRaceSoftHint } from "@/lib/match-hub/manual-link-hints";
import { ManualRaceLinkPanel } from "@/components/manual-race-link-panel";
import { discoverRaces } from "@/lib/discover-races";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { getPortfolioRaceLabel } from "@/lib/portfolio-race-label";
import { getDiscoverPrestigeMeta } from "@/lib/discover-race-prestige";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { formatStravaMovingTime } from "@/lib/strava-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActivityRouteMap } from "@/components/activity-route-map";
import { ActivityElevationProfile } from "@/components/activity-elevation-profile";
import { ActivityPhotoGalleryEditor } from "@/components/activity-photo-gallery-editor";

type Props = {
  stravaView: ActivityPortfolioStravaView;
  stravaEnrichment: ActivityPortfolioStravaEnrichment;
  race: Race | null;
  suggestedDiscoverRaceId: string | null;
  catalogDisplayTitle: string | null;
  stravaFetchFailed: boolean;
  bucketListGoalActive: boolean;
  manualLinkSoftHints: ManualRaceSoftHint[];
  canonicalRaceSlug?: string | null;
};

function mergePhotoUrls(strava: string[], manual: string[] | null | undefined): string[] {
  const m = manual ?? [];
  const combined = [...m, ...strava];
  return [...new Set(combined.filter(Boolean))];
}

function legacyReflectionsAsText(race: Race | null): string {
  if (!race) return "";
  const parts = [race.reflection_toughest, race.reflection_learned, race.reflection_mattered].filter(
    (s): s is string => Boolean(s?.trim())
  );
  return parts.join("\n\n").trim();
}

export function ActivityPortfolioClient({
  stravaView,
  stravaEnrichment,
  race,
  suggestedDiscoverRaceId,
  catalogDisplayTitle,
  stravaFetchFailed,
  bucketListGoalActive,
  manualLinkSoftHints,
  canonicalRaceSlug
}: Props) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [linkUiOpen, setLinkUiOpen] = useState(() => !race?.canonical_race_id);
  const [linkAuxPending, startLinkAux] = useTransition();

  const [titleEditing, setTitleEditing] = useState(false);
  const [subtitleEditing, setSubtitleEditing] = useState(false);

  const effectiveDiscoverId = race?.discover_race_id ?? suggestedDiscoverRaceId;
  const canonicalHref =
    race?.canonical_race_id && canonicalRaceSlug
      ? `/races/${canonicalRaceSlug}`
      : race?.canonical_race_id
        ? `/races/${race.canonical_race_id}`
        : null;
  const prestige = getDiscoverPrestigeMeta(effectiveDiscoverId);
  const displayTitle = race ? getPortfolioRaceLabel(race) : stravaView.name;

  const savedStory = race?.description?.trim() ?? "";
  const legacyBlock = !savedStory ? legacyReflectionsAsText(race) : "";
  const stravaStoryHint = stravaView.description?.trim() ?? "";
  const narrativeDisplay = savedStory || legacyBlock || stravaStoryHint;
  const stravaOnlyCaption = Boolean(!savedStory && !legacyBlock && stravaStoryHint);

  const storyBaselineRef = useRef(narrativeDisplay);
  const [storyDraft, setStoryDraft] = useState(narrativeDisplay);
  useEffect(() => {
    storyBaselineRef.current = narrativeDisplay;
    setStoryDraft(narrativeDisplay);
  }, [narrativeDisplay]);

  const photos = useMemo(
    () => mergePhotoUrls(stravaView.photo_urls, race?.manual_photo_urls),
    [stravaView.photo_urls, race?.manual_photo_urls]
  );
  const heroScene = getRaceSceneImagePath(displayTitle);
  const sportLabel = stravaView.sport_type || stravaView.type || "Run";
  const ingestSource = stravaView.activity_source ?? "strava";
  const isStravaSource = ingestSource === "strava";
  const sourceBadge =
    ingestSource === "garmin_file"
      ? "Imported · FIT file"
      : ingestSource === "manual_file"
        ? "Imported · GPX/TCX file"
        : null;

  const polyline = stravaView.summary_polyline?.trim() || null;

  useEffect(() => {
    if (race?.canonical_race_id) setLinkUiOpen(false);
  }, [race?.canonical_race_id]);

  const runPatch = useCallback(
    (partial: Partial<ActivityPortfolioPatch>) => {
      const name =
        partial.name?.trim() ||
        (race ? getPortfolioRaceLabel(race) : stravaView.name).trim() ||
        stravaView.name;
      startTransition(async () => {
        setErr(null);
        const res = await patchActivityPortfolioAction({
          strava_activity_id: stravaView.strava_id,
          name,
          ...partial
        });
        if (res && "error" in res && res.error) {
          setErr(res.error);
          return;
        }
        router.refresh();
      });
    },
    [race, router, stravaView.name, stravaView.strava_id]
  );

  const onCommitManualPhotos = useCallback(
    (urls: string[]) => {
      runPatch({ manual_photo_urls: urls });
    },
    [runPatch]
  );

  const tagDefs = [
    { key: "tag_pb" as const, label: "PB" },
    { key: "tag_career_highlight" as const, label: "Career highlight" },
    { key: "tag_hardest" as const, label: "Hardest" },
    { key: "tag_bucket_list_done" as const, label: "Bucket list done" }
  ];

  const statGrid = [
    { label: "Distance", value: `${stravaView.distance_km} km` },
    { label: "Moving time", value: stravaView.moving_time_label },
    { label: "Elapsed", value: stravaView.elapsed_time_label ?? "—" },
    { label: "Pace", value: stravaView.pace_label ?? "—" },
    { label: "Elevation", value: stravaView.elevation_m != null ? `${stravaView.elevation_m} m` : "—" },
    { label: "Location", value: stravaView.location_label },
    { label: "Kudos", value: String(stravaView.kudos_count) },
    { label: "Achievements", value: String(stravaView.achievement_count) }
  ];

  const splitsRaw = stravaEnrichment.splits_metric;
  const splits = splitsRaw?.length ? splitsRaw : null;
  const splitsShowElevCol = Boolean(splits?.some((s) => s.elevation_m != null));

  return (
    <>
      <section className="relative min-h-[340px] overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- external CDN / storage URLs
            <img src={photos[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src={heroScene} alt="" fill className="object-cover" sizes="100vw" priority />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/78 to-black/35" />
        <div className="relative z-10 mx-auto flex min-h-[340px] max-w-5xl flex-col justify-end px-5 pb-10 pt-24 md:px-8">
          <Link href="/dashboard" className="mb-6 w-fit text-[13px] font-medium text-white/70 transition hover:text-white">
            ← Back
          </Link>
          <p className="type-tagline mb-2">Your race</p>

          <div className="max-w-4xl">
            {titleEditing ? (
              <Input
                key={displayTitle}
                autoFocus
                defaultValue={displayTitle}
                className="type-display h-auto border-white/25 bg-black/55 py-2 text-3xl font-semibold text-white md:text-4xl"
                disabled={pending}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  setTitleEditing(false);
                  if (v && v !== displayTitle) runPatch({ name: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setTitleEditing(false);
                }}
              />
            ) : (
              <h1
                className="type-display cursor-text text-white outline-none ring-offset-2 hover:underline hover:decoration-white/30 hover:underline-offset-4"
                onClick={() => setTitleEditing(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setTitleEditing(true);
                }}
              >
                {displayTitle}
              </h1>
            )}
          </div>

          <div className="mt-3 max-w-2xl">
            {subtitleEditing ? (
              <Input
                key={race?.race_subtitle ?? "sub"}
                autoFocus
                defaultValue={race?.race_subtitle ?? ""}
                placeholder="Subtitle (optional)"
                className="border-white/25 bg-black/45 text-lg text-white/90"
                disabled={pending}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  setSubtitleEditing(false);
                  const cur = race?.race_subtitle?.trim() ?? "";
                  if (v !== cur) runPatch({ race_subtitle: v || null });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setSubtitleEditing(false);
                }}
              />
            ) : (
              <button
                type="button"
                className="text-left text-lg text-white/80 hover:text-white"
                onClick={() => setSubtitleEditing(true)}
              >
                {race?.race_subtitle?.trim() ? (
                  race.race_subtitle
                ) : (
                  <span className="text-white/45">Add a subtitle…</span>
                )}
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm tabular-nums text-white/85">
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1">{stravaView.distance_km} km</span>
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1">{stravaView.moving_time_label}</span>
            {stravaView.pace_label ? (
              <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1">{stravaView.pace_label}</span>
            ) : null}
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1">{stravaView.start_date}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="border border-white/20 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90">
              {sportLabel}
            </span>
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
            {sourceBadge ? (
              <span className="border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
                {sourceBadge}
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isStravaSource && stravaView.strava_url ? (
              <a
                href={stravaView.strava_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border border-white/25 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition hover:border-teal/50 hover:text-teal-hover"
              >
                Open in Strava
              </a>
            ) : null}
            {canonicalHref ? (
              <Link
                href={canonicalHref}
                className="inline-flex items-center border border-teal/40 bg-teal/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal transition hover:bg-teal/20"
              >
                Verified race · catalog
              </Link>
            ) : effectiveDiscoverId ? (
              <Link
                href={`/races/${effectiveDiscoverId}`}
                className="inline-flex items-center border border-teal/40 bg-teal/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal transition hover:bg-teal/20"
              >
                {getCatalogDisplayTitle(effectiveDiscoverId)} · catalog
              </Link>
            ) : catalogDisplayTitle ? (
              <span className="inline-flex items-center border border-white/15 bg-black/40 px-4 py-2 text-[11px] text-white/60">
                Suggested: {catalogDisplayTitle}
              </span>
            ) : null}
            {race?.canonical_race_id ? (
              <Button
                type="button"
                className="border border-gold/35 bg-gold/10 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold hover:bg-gold/15"
                onClick={() => setLinkUiOpen(true)}
              >
                Change race link
              </Button>
            ) : (
              <a
                href="#manual-race-link"
                className="inline-flex items-center border border-accent/50 bg-accent/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent transition hover:bg-accent/30"
              >
                Link to race
              </a>
            )}
          </div>
        </div>
      </section>

      <main className="app-shell space-y-14 pb-24 pt-10">
        {err ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</p>
        ) : null}

        {linkUiOpen ? (
          <section id="manual-race-link" className="scroll-mt-28 space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Catalog link</h2>
            <ManualRaceLinkPanel
              ctx={{
                stravaActivityId: stravaView.strava_id,
                activityTitle: stravaView.name,
                startDateYmd: stravaView.start_date.slice(0, 10),
                distanceKm: stravaView.distance_km,
                elevationM: stravaView.elevation_m
              }}
              softSuggestions={manualLinkSoftHints}
              responseMode="page"
              returnTo={`/activities/${encodeURIComponent(stravaView.strava_id)}`}
              showUnlink={Boolean(race?.canonical_race_id)}
              onUnlinked={() => setLinkUiOpen(true)}
              pending={linkAuxPending}
              onNotRace={() => {
                startLinkAux(async () => {
                  const fd = new FormData();
                  fd.set("strava_activity_id", stravaView.strava_id);
                  await markStravaActivityNotRaceAction(fd);
                  router.refresh();
                });
              }}
              onSnooze={() => {
                startLinkAux(async () => {
                  const fd = new FormData();
                  fd.set("strava_activity_id", stravaView.strava_id);
                  await snoozeStravaActivityMatchHubAction(fd);
                  router.refresh();
                });
              }}
            />
            {race?.canonical_race_id ? (
              <button
                type="button"
                className="text-[11px] text-white/40 underline-offset-4 hover:text-white/60 hover:underline"
                onClick={() => setLinkUiOpen(false)}
              >
                Close
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Story</h2>
          <div className="flex flex-wrap gap-2">
            {tagDefs.map(({ key, label }) => {
              const on = Boolean(race?.[key]);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => runPatch({ [key]: !on })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition",
                    on
                      ? "border-accent/60 bg-accent/20 text-accent"
                      : "border-white/18 bg-white/[0.04] text-white/65 hover:border-white/35 hover:text-white/90"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative rounded-xl border border-white/10 bg-[#0b0b0b] p-6 md:p-8">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Your race story</p>
            {stravaOnlyCaption ? (
              <p className="mb-2 text-xs text-white/45">Prefilled from Strava — edit and it becomes your portfolio version.</p>
            ) : null}
            <textarea
              value={storyDraft}
              onChange={(e) => setStoryDraft(e.target.value)}
              disabled={pending}
              onBlur={() => {
                const next = storyDraft.trim();
                if (next === storyBaselineRef.current.trim()) return;
                runPatch({ description: next || null });
              }}
              rows={Math.min(18, Math.max(6, Math.ceil(storyDraft.length / 88) + 4))}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-[15px] leading-relaxed text-white/90 placeholder:text-muted focus:border-teal/50 focus:outline-none focus:ring-1 focus:ring-teal/30"
              placeholder="How did the day feel? What happened out there?"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Photos</h3>
            <ActivityPhotoGalleryEditor
              stravaActivityId={stravaView.strava_id}
              manualUrls={race?.manual_photo_urls ?? []}
              stravaPhotoUrls={stravaView.photo_urls}
              onCommitManualUrls={onCommitManualPhotos}
              busy={pending}
            />
          </div>

          <details className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
            <summary className="cursor-pointer select-none text-white/70">Details & catalog match</summary>
            <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Catalog race</label>
                <select
                  className="mt-2 flex h-10 w-full border border-white/15 bg-black/50 px-3 text-sm text-white"
                  value={effectiveDiscoverId ?? ""}
                  disabled={pending}
                  onChange={(e) => {
                    const v = e.target.value.trim() || null;
                    runPatch({ discover_race_id: v });
                  }}
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
                  key={`${race?.id}-${race?.date ?? stravaView.start_date}`}
                  type="date"
                  className="mt-2 border-white/15 bg-black/50"
                  defaultValue={(race?.date ?? stravaView.start_date).slice(0, 10)}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const cur = (race?.date ?? stravaView.start_date).slice(0, 10);
                    if (v && v !== cur) runPatch({ date: v });
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Location</label>
                <Input
                  key={`${race?.id}-loc`}
                  className="mt-2 border-white/15 bg-black/50"
                  defaultValue={race?.location ?? stravaView.location_label}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const cur = race?.location ?? stravaView.location_label;
                    if (v !== cur) runPatch({ location: v || null });
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Distance (km)</label>
                <Input
                  key={`${race?.id}-dist`}
                  type="number"
                  step="0.1"
                  className="mt-2 border-white/15 bg-black/50"
                  defaultValue={race?.distance_km ?? stravaView.distance_km}
                  disabled={pending}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    const cur = race?.distance_km ?? stravaView.distance_km;
                    if (n !== cur) runPatch({ distance_km: n });
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Elevation (m)</label>
                <Input
                  key={`${race?.id}-elev-${race?.elevation_m ?? ""}`}
                  type="number"
                  className="mt-2 border-white/15 bg-black/50"
                  defaultValue={race?.elevation_m ?? stravaView.elevation_m ?? ""}
                  disabled={pending}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      runPatch({ elevation_m: null });
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    const cur = race?.elevation_m ?? stravaView.elevation_m;
                    if (n !== (cur ?? NaN)) runPatch({ elevation_m: n });
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Moving time</label>
                <Input
                  key={`${race?.id}-time`}
                  className="mt-2 border-white/15 bg-black/50"
                  defaultValue={race?.time ?? stravaView.moving_time_label}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const cur = race?.time ?? stravaView.moving_time_label;
                    if (v !== cur) runPatch({ time: v || null });
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  Finish / placement notes
                </label>
                <textarea
                  key={`${race?.id}-finish`}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                  rows={3}
                  defaultValue={race?.finish_notes ?? ""}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const cur = race?.finish_notes?.trim() ?? "";
                    if (v !== cur) runPatch({ finish_notes: v || null });
                  }}
                />
              </div>
            </div>
          </details>
        </section>

        <section className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            {isStravaSource ? "Activity data" : "Imported metrics"}
          </h2>
          <Card className="border-white/10 bg-[#0a0a0a] p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statGrid.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{label}</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>

            {stravaEnrichment.elevation_profile ? (
              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Elevation</p>
                <ActivityElevationProfile profile={stravaEnrichment.elevation_profile} className="mt-4" />
              </div>
            ) : stravaView.elevation_m != null ? (
              <p className="mt-6 text-sm text-muted">No stream-based elevation profile for this activity (privacy or API limits).</p>
            ) : null}

            {polyline ? (
              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Route</p>
                <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
                  <ActivityRouteMap encodedPolyline={polyline} />
                </div>
                {isStravaSource && stravaView.strava_url ? (
                  <p className="mt-3 text-sm text-white/65">
                    <a href={stravaView.strava_url} className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline" target="_blank" rel="noreferrer">
                      Open full map on Strava →
                    </a>
                  </p>
                ) : null}
              </div>
            ) : stravaView.has_map ? (
              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Route</p>
                <p className="mt-2 text-sm text-white/75">
                  {isStravaSource && stravaView.strava_url ? (
                    <>
                      Map on{" "}
                      <a
                        href={stravaView.strava_url}
                        className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Strava
                      </a>
                      .
                    </>
                  ) : (
                    <>Route stored for this import; polyline preview unavailable.</>
                  )}
                </p>
              </div>
            ) : null}

            {stravaView.description ? (
              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  {isStravaSource ? "Strava activity notes" : "Import notes"}
                </p>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/75">{stravaView.description}</p>
              </div>
            ) : null}

            {splits ? (
              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Splits (metric)</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-sm text-white/85">
                    <thead className="text-[10px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="pb-2 pr-4">Leg</th>
                        <th className="pb-2 pr-4">Dist</th>
                        <th className="pb-2">Time</th>
                        {splitsShowElevCol ? <th className="pb-2">± Elev</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {splits.map((s) => (
                        <tr key={s.index} className="border-t border-white/10">
                          <td className="py-2 pr-4 tabular-nums">{s.index}</td>
                          <td className="py-2 pr-4 tabular-nums">{(s.distance_m / 1000).toFixed(2)} km</td>
                          <td className="py-2 tabular-nums">{formatStravaMovingTime(s.moving_time_sec)}</td>
                          {splitsShowElevCol ? (
                            <td className="py-2 tabular-nums text-white/65">
                              {s.elevation_m != null ? `${s.elevation_m} m` : ""}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      </main>
    </>
  );
}
