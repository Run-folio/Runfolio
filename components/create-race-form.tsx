"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Activity, ActivityMatchInput, CatalogRaceSuggestion, Race, StravaFeedActivity } from "@/types";
import { confirmCustomMajorEffortAction, createRaceAction } from "@/lib/actions";
import { stravaFeedToActivity } from "@/lib/strava-feed-to-activity";
import { StravaActivityCard } from "@/components/strava-activity-card";
import { RaceMatchConfirmation } from "@/components/race-match-confirmation";
import { asFormAction } from "@/lib/server-action-form";
import { suggestRaceMatch } from "@/lib/match-races";
import {
  getDiscoverRaceById,
  isUnmatchedMajorEffortCandidate,
  RACE_MATCH_HIGH_SCORE,
  rankKnownRaceMatches
} from "@/lib/known-race-match";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Props = {
  existingRaces: Race[];
  stravaOAuthConfigured?: boolean;
  stravaConnected?: boolean;
  stravaError?: string;
  /** Strava activities from Runfolio sync (high-signal + manual-link cache — no live Strava list here). */
  recentStravaActivities?: StravaFeedActivity[];
  /** Prefill from Find a Race → catalog detail. */
  initialDiscoverRaceId?: string;
};

export function CreateRaceForm({
  existingRaces,
  stravaOAuthConfigured = false,
  stravaConnected = false,
  stravaError,
  recentStravaActivities = [],
  initialDiscoverRaceId
}: Props) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    date: "",
    distance_km: "",
    elevation_m: "",
    time: "",
    description: "",
    is_completed: true
  });
  const [url, setUrl] = useState("https://www.strava.com/activities/123456789");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [hasRoutePreview, setHasRoutePreview] = useState(false);
  const [pendingMatchInput, setPendingMatchInput] = useState<ActivityMatchInput | null>(null);
  const [matchDismissedForStravaId, setMatchDismissedForStravaId] = useState<string | null>(null);
  const [stravaHeroPhoto, setStravaHeroPhoto] = useState<string | null>(null);
  const [customMajorName, setCustomMajorName] = useState("");
  const [customMajorPending, startCustomMajor] = useTransition();
  const [customMajorError, setCustomMajorError] = useState<string | null>(null);
  const appliedDiscoverRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialDiscoverRaceId || appliedDiscoverRef.current === initialDiscoverRaceId) return;
    const disc = getDiscoverRaceById(initialDiscoverRaceId);
    if (!disc) return;
    appliedDiscoverRef.current = initialDiscoverRaceId;
    const title = getCatalogDisplayTitle(initialDiscoverRaceId);
    setForm((prev) => ({
      ...prev,
      name: prev.name || title,
      distance_km: prev.distance_km || String(disc.distance_km),
      location: prev.location || disc.location
    }));
  }, [initialDiscoverRaceId]);

  const raceEffortsWithHints = useMemo(() => {
    return recentStravaActivities.map((a) => {
      const ranked = rankKnownRaceMatches(toMatchInputFromFeed(a), existingRaces, 0.28);
      const top = ranked[0];
      if (!top || top.score < RACE_MATCH_HIGH_SCORE || top.confidence !== "high") {
        return { activity: a, catalogSuggestion: null as CatalogRaceSuggestion | null };
      }
      const catalogSuggestion: CatalogRaceSuggestion = {
        discoverRaceId: top.discoverRaceId,
        displayTitle: getCatalogDisplayTitle(top.discoverRaceId),
        confidence: top.confidence,
        score: top.score,
        reasons: top.reasons,
        onUserBucketList: top.onUserBucketList,
        userRaceId: top.userRaceId
      };
      return { activity: a, catalogSuggestion };
    });
  }, [recentStravaActivities, existingRaces]);

  const match = useMemo(() => {
    if (!form.distance_km || !form.date) return null;
    return suggestRaceMatch(existingRaces, Number(form.distance_km), form.date);
  }, [existingRaces, form.date, form.distance_km]);

  const matchCandidates = useMemo(() => {
    if (!pendingMatchInput) return [];
    return rankKnownRaceMatches(pendingMatchInput, existingRaces);
  }, [pendingMatchInput, existingRaces]);

  const showUnmatchedMajor = useMemo(() => {
    if (!pendingMatchInput) return false;
    return isUnmatchedMajorEffortCandidate(pendingMatchInput, matchCandidates);
  }, [pendingMatchInput, matchCandidates]);

  /** Primitives only: avoids effect re-running when `pendingMatchInput` is replaced with a new object for the same activity (would reset the custom-major field while typing). */
  const pendingStravaId = pendingMatchInput?.strava_id ?? null;
  const pendingActivityTitle = pendingMatchInput?.name ?? "";

  useEffect(() => {
    if (!pendingStravaId?.trim()) {
      setCustomMajorName("");
      setCustomMajorError(null);
      return;
    }
    setCustomMajorName(pendingActivityTitle || "");
  }, [pendingStravaId, pendingActivityTitle]);

  function toMatchInputFromActivity(activity: Activity): ActivityMatchInput {
    return {
      strava_id: activity.strava_id,
      name: activity.name,
      distance_km: activity.distance_km,
      date: activity.date,
      elevation_m: activity.elevation_m ?? null,
      location_city: null,
      location_country: null,
      start_latitude: activity.start_lat,
      start_longitude: activity.start_lng,
      sport_type: null,
      type: null
    };
  }

  function toMatchInputFromFeed(feed: StravaFeedActivity): ActivityMatchInput {
    return {
      strava_id: feed.strava_id,
      name: feed.name,
      distance_km: feed.distance_km,
      date: feed.start_date.slice(0, 10),
      elevation_m: feed.elevation_m,
      location_city: feed.location_city,
      location_country: feed.location_country,
      sport_type: feed.sport_type,
      type: feed.type
    };
  }

  function openMatcher(input: ActivityMatchInput) {
    if (!input.strava_id?.trim()) {
      setPendingMatchInput(null);
      return;
    }
    if (input.strava_id === matchDismissedForStravaId) {
      setPendingMatchInput(null);
      return;
    }
    const ranked = rankKnownRaceMatches(input, existingRaces);
    const unmatchedMajor = isUnmatchedMajorEffortCandidate(input, ranked);
    if (ranked.length === 0 && !unmatchedMajor) {
      setPendingMatchInput(null);
      return;
    }
    setPendingMatchInput(input);
  }

  const applyActivity = (activity: Activity) => {
    setHasRoutePreview(Boolean(activity.polyline));
    setStravaHeroPhoto(activity.primary_photo_url ?? null);
    setForm((prev) => ({
      ...prev,
      name: prev.name || activity.name,
      date: activity.date,
      distance_km: String(activity.distance_km),
      time: activity.moving_time || prev.time,
      elevation_m:
        activity.elevation_m != null && !Number.isNaN(activity.elevation_m)
          ? String(Math.round(activity.elevation_m))
          : prev.elevation_m,
      description: activity.description ?? prev.description
    }));
  };

  const applyFromStravaFeed = (feed: StravaFeedActivity) => {
    const act = stravaFeedToActivity(feed);
    applyActivity(act);
    const loc = [feed.location_city, feed.location_country].filter(Boolean).join(", ");
    if (loc) {
      setForm((prev) => ({ ...prev, location: prev.location || loc }));
    }
    setImportNotice(`Loaded “${feed.name}” from your Strava activities.`);
    setImportError(null);
    openMatcher(toMatchInputFromFeed(feed));
  };

  const handleStravaImport = async () => {
    setImportError(null);
    setImportNotice(null);
    setImporting(true);
    try {
      const res = await fetch("/api/strava/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = (await res.json()) as {
        activity?: Activity;
        error?: string;
        warning?: string;
        source?: string;
      };
      if (!res.ok) {
        setImportError(data.error ?? `Import failed (${res.status})`);
        return;
      }
      if (data.activity) {
        applyActivity(data.activity);
        openMatcher(toMatchInputFromActivity(data.activity));
      }
      if (data.warning) setImportNotice(data.warning);
      else if (data.source === "strava") setImportNotice("Imported from Strava.");
    } catch {
      setImportError("Network error while contacting Strava.");
    } finally {
      setImporting(false);
    }
  };

  const formSnap = {
    date: form.date,
    distance_km: form.distance_km,
    elevation_m: form.elevation_m,
    time: form.time,
    location: form.location,
    description: form.description
  };

  const runSaveCustomMajor = () => {
    if (!pendingMatchInput) return;
    const dist = Number(formSnap.distance_km);
    if (!Number.isFinite(dist) || dist < 50) {
      setCustomMajorError("Distance must be at least 50 km to save as a custom ultra.");
      return;
    }
    setCustomMajorError(null);
    startCustomMajor(async () => {
      const fd = new FormData();
      fd.set("strava_activity_id", pendingMatchInput.strava_id);
      fd.set(
        "custom_name",
        customMajorName.trim() || pendingMatchInput.name || "Major trail / ultra effort"
      );
      fd.set("date", formSnap.date);
      fd.set("distance_km", formSnap.distance_km);
      fd.set("elevation_m", formSnap.elevation_m);
      fd.set("time", formSnap.time);
      fd.set("location", formSnap.location);
      fd.set("return_to", "/races/new");
      const res = await confirmCustomMajorEffortAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) {
        setCustomMajorError(String(res.error));
      }
    });
  };

  return (
    <>
      {stravaOAuthConfigured ? (
        <Card className="mb-5 border border-amber-400/25 bg-amber-950/20 p-4">
          <p className="text-sm leading-relaxed text-white/85">
            <span className="font-semibold text-amber-100/95">Batch Strava race review?</span> The{" "}
            <Link href="/matches" className="font-semibold text-accent underline-offset-4 hover:underline">
              Match &amp; import hub
            </Link>{" "}
            is the main place to confirm smart matches, clear rejects, and manually link verified events. Use this
            page for a one-off add.
          </p>
        </Card>
      ) : null}
      <form action={asFormAction(createRaceAction)} className="space-y-4">
      <Card className="bg-panelAlt/85 p-0">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="border border-border bg-black/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Import from Strava (recommended)</p>
            <p className="mt-1 text-sm text-muted">Paste your Strava activity link and we will auto-fill the details and stats.</p>
            {stravaConnected ? (
              <p className="mt-2 text-sm text-green-400" role="status">
                Strava connected — imports use your account (activity:read).
              </p>
            ) : null}
            {stravaError ? (
              <p className="mt-2 text-sm text-red-300" role="alert">
                Strava: {stravaError}
              </p>
            ) : null}
            {stravaOAuthConfigured ? (
              <p className="mt-3 text-sm">
                <Link
                  href="/api/strava/oauth/start"
                  className="font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Connect Strava
                </Link>{" "}
                <span className="text-muted">(opens Strava, then returns here)</span>
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Add <code className="text-white/80">STRAVA_CLIENT_ID</code> and{" "}
                <code className="text-white/80">STRAVA_CLIENT_SECRET</code> to enable Connect Strava, or set{" "}
                <code className="text-white/80">STRAVA_ACCESS_TOKEN</code> in{" "}
                <code className="text-white/80">.env.local</code>.
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.strava.com/activities/…"
                className="sm:min-w-0 sm:flex-1"
              />
              <Button type="button" disabled={importing} onClick={() => void handleStravaImport()}>
                {importing ? "Importing…" : "Import Activity"}
              </Button>
            </div>
            {importError ? (
              <p className="mt-2 text-xs text-red-300" role="alert">
                {importError}
              </p>
            ) : null}
            {importNotice ? (
              <p className="mt-2 text-xs text-amber-200/90" role="status">
                {importNotice}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Uses your Strava access token on the server (see README). Activities you can see must be allowed for that
              token. Nothing is written to Strava.
            </p>
            {stravaConnected && raceEffortsWithHints.length > 0 ? (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Your race candidates</p>
                <p className="mt-1 text-xs text-muted">
                  ≥21 km · Run / Trail Run / Race only — tap to autofill and confirm a catalog match if suggested.
                </p>
                <div className="mt-3 grid max-h-[340px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {raceEffortsWithHints.slice(0, 12).map(({ activity: a, catalogSuggestion }) => (
                    <StravaActivityCard
                      key={a.strava_id}
                      activity={a}
                      catalogSuggestion={catalogSuggestion}
                      onSelect={() => applyFromStravaFeed(a)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="border border-border bg-black/30 p-4">
            <p className="text-sm font-semibold">How it works</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted">
              <div><p className="text-accent">1</p><p>Import</p></div>
              <div><p className="text-accent">2</p><p>Review</p></div>
              <div><p className="text-accent">3</p><p>Reflect</p></div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-green/30 bg-green-950/20">
        <div className="grid gap-3 text-sm md:grid-cols-5">
          <p className="md:col-span-2">
            <span className="font-semibold text-green">Auto-filled from Strava</span>
            <br />
            <span className="text-muted">{form.name || "UTMB 2024"} - {form.date || "Aug 30, 2024"}</span>
          </p>
          <p><span className="text-muted">Distance</span><br />{form.distance_km || "171.2"} km</p>
          <p><span className="text-muted">Elevation</span><br />{form.elevation_m || "10,040"} m</p>
          <p><span className="text-muted">Moving Time</span><br />{form.time || "23:57:13"}</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.25fr_0.9fr]">
        <Card className="space-y-4 bg-panelAlt/90">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Race Details</h3>
          <Input name="name" placeholder="Race Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input name="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input name="location" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input name="distance_km" type="number" step="0.1" placeholder="Distance (km)" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
          <Input name="elevation_m" type="number" placeholder="Elevation (m)" value={form.elevation_m} onChange={(e) => setForm({ ...form, elevation_m: e.target.value })} />
          <Input name="time" placeholder="Time (e.g. 23:57:13)" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted">Tags</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Career Highlight", "PB", "Hardest Race", "Bucket List"].map((tag) => (
                <span key={tag} className="border border-border bg-black/30 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="is_completed" checked={form.is_completed} onChange={(e) => setForm({ ...form, is_completed: e.target.checked })} />
            Completed race
          </label>
        </Card>

        <div className="space-y-4">
          <Card className="bg-panelAlt/90">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">The Story</h3>
            <p className="mt-3 text-muted">This is the heart of it. What made this race unforgettable?</p>
            <textarea
              name="description"
              placeholder="Write about the race, the highs and lows, the emotions..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-3 min-h-44 w-full rounded-md border border-border bg-[#070b12] px-3 py-2 text-sm leading-relaxed text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {["The build up", "The hardest moment", "What surprised you", "How it felt at the finish"].map((prompt) => (
                <span key={prompt} className="rounded-md border border-border bg-black/30 px-2 py-1 text-[11px] text-slate-300">
                  {prompt}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["The Moment", "The moment that defined the race."],
              ["What I Learned", "What did this race teach you?"],
              ["Why it Mattered", "Why will you always remember this one?"]
            ].map(([title, body]) => (
              <Card key={title} className="bg-panelAlt/90">
                <p className="text-sm font-semibold text-gold">{title}</p>
                <p className="mt-2 text-xs text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden bg-panelAlt/90 p-0">
            <div className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Course Map</h3>
            </div>
            <div
              className={`relative h-60 bg-cover bg-center ${hasRoutePreview ? "border-b border-accent/25" : ""}`}
              style={
                hasRoutePreview
                  ? {
                      backgroundImage:
                        "linear-gradient(145deg, rgba(232,122,61,0.15) 0%, rgba(5,7,12,0.95) 45%, #05070c 100%)"
                    }
                  : { backgroundImage: "url('/reference/hero-3.png')" }
              }
            >
              {hasRoutePreview ? (
                <div className="flex h-full flex-col justify-end p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Route data</p>
                  <p className="mt-1 text-xs text-muted">
                    Polyline from Strava — open the activity on Strava for the full interactive map.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between p-4 text-sm">
              <p>
                {form.distance_km || "—"} km &nbsp; {form.elevation_m || "—"} m+
              </p>
              <a
                href={
                  form.name
                    ? `https://www.strava.com/search/results?q=${encodeURIComponent(form.name)}`
                    : "https://www.strava.com"
                }
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Strava
              </a>
            </div>
          </Card>

          <Card className="bg-panelAlt/90">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Photos</h3>
              <span className="text-xs text-green">Auto-filled (8)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div
                className="h-16 border border-border bg-cover bg-center"
                style={{
                  backgroundImage: stravaHeroPhoto
                    ? `url("${stravaHeroPhoto.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`
                    : "url('/reference/hero-1.png')"
                }}
              />
              {[2, 3, 4].map((i) => (
                <div key={i} className="h-16 border border-border bg-cover bg-center" style={{ backgroundImage: "url('/reference/hero-1.png')" }} />
              ))}
            </div>
            <div className="mt-3 border border-dashed border-border p-4 text-center text-sm text-muted">+ Add More Photos</div>
          </Card>
        </div>
      </div>

      {match ? (
        <Card className="bg-black/35 p-3">
          <p className="text-sm text-muted">
            We think this might be: <span className="font-semibold text-white">{match.race.name}</span>
          </p>
        </Card>
      ) : null}

      <Card className="bg-panelAlt/85">
        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
          <p className="text-sm text-muted">All changes are saved automatically</p>
          <Button type="submit" className="min-w-36">
            Save Race
          </Button>
        </div>
      </Card>
    </form>

    {pendingMatchInput && matchCandidates.length > 0 ? (
      <div className="mt-6">
        <RaceMatchConfirmation
          candidates={matchCandidates}
          stravaActivityId={pendingMatchInput.strava_id}
          activityTitle={pendingMatchInput.name}
          formSnap={formSnap}
          returnTo="/races/new"
          onDismiss={() => {
            setMatchDismissedForStravaId(pendingMatchInput.strava_id);
            setPendingMatchInput(null);
          }}
        />
      </div>
    ) : null}

    {pendingMatchInput && showUnmatchedMajor ? (
      <Card className="mt-6 border-amber-500/25 bg-amber-950/15 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
          Unmatched major effort
        </p>
        <p className="mt-2 text-sm text-muted">
          This activity is ≥50 km and doesn&apos;t match the catalog strongly. Save it as a portfolio finish now; you can
          link a catalog race later from your profile.
        </p>
        {customMajorError ? (
          <p className="mt-2 text-sm text-red-300" role="alert">
            {customMajorError}
          </p>
        ) : null}
        <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Display name</label>
            <Input
              value={customMajorName}
              onChange={(e) => setCustomMajorName(e.target.value)}
              placeholder="Race or event name (optional)"
              className="mt-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={customMajorPending} onClick={runSaveCustomMajor}>
              {customMajorPending ? "Saving…" : "Save without catalog match"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={customMajorPending}
              onClick={() => {
                setMatchDismissedForStravaId(pendingMatchInput.strava_id);
                setPendingMatchInput(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </Card>
    ) : null}
    </>
  );
}
