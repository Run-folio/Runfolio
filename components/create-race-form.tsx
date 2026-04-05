"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Activity, ActivityMatchInput, Race } from "@/types";
import { confirmCustomMajorEffortAction, createRaceAction } from "@/lib/actions";
import { RaceMatchConfirmation } from "@/components/race-match-confirmation";
import { asFormAction } from "@/lib/server-action-form";
import { suggestRaceMatch } from "@/lib/match-races";
import { getDiscoverRaceById, isUnmatchedMajorEffortCandidate, rankKnownRaceMatches } from "@/lib/known-race-match";
import { getCatalogDisplayTitle } from "@/lib/discover-race-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function InfoHint({ label, text }: { label: string; text: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-bold text-muted transition hover:border-white/30 hover:text-white"
      aria-label={label}
      title={text.replace(/\s+/g, " ").trim()}
    >
      ?
    </button>
  );
}

function StepIcon({ children, done }: { children: ReactNode; done?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
        done ? "border-accent/50 bg-accent/15 text-accent" : "border-white/15 bg-black/30 text-white/80"
      )}
    >
      {children}
    </div>
  );
}

type Props = {
  existingRaces: Race[];
  stravaOAuthConfigured?: boolean;
  stravaConnected?: boolean;
  stravaError?: string;
  /** Prefill from Find a Race → catalog detail. */
  initialDiscoverRaceId?: string;
};

export function CreateRaceForm({
  existingRaces,
  stravaOAuthConfigured = false,
  stravaConnected = false,
  stravaError,
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
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [showStravaConnectHint, setShowStravaConnectHint] = useState(false);
  const [activityImported, setActivityImported] = useState(false);
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

  const handleStravaImport = async () => {
    setImportError(null);
    setImportNotice(null);
    setShowStravaConnectHint(false);
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
        const msg = data.error ?? `Import failed (${res.status})`;
        setImportError(msg);
        if (/strava|token|connect|401|unauthorized|sign in|not connected/i.test(msg)) {
          setShowStravaConnectHint(true);
        }
        return;
      }
      if (data.source === "mock") {
        setShowStravaConnectHint(true);
      } else {
        setShowStravaConnectHint(false);
      }
      if (data.activity) {
        applyActivity(data.activity);
        openMatcher(toMatchInputFromActivity(data.activity));
        setActivityImported(true);
      }
      if (data.warning) setImportNotice(data.warning);
      else if (data.source === "strava") setImportNotice(null);
    } catch {
      setImportError("Could not reach import service.");
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

  const matchStepActive = Boolean(pendingMatchInput && matchCandidates.length > 0);

  return (
    <>
      <form action={asFormAction(createRaceAction)} className="space-y-10">
      <div className="mx-auto w-full max-w-xl space-y-8 md:max-w-lg">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste your Strava activity"
              aria-label="Paste your Strava activity"
              className="h-12 flex-1 text-base"
            />
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <InfoHint
                label="How import works"
                text="Paste a Strava activity URL. We read distance, time, elevation, and route data to fill the form. Your activity is not modified on Strava."
              />
              <InfoHint
                label="What data is used"
                text="We use the activity title, date, distance, and locations to suggest catalog race matches. Details are stored only in your Runfolio account."
              />
            </div>
          </div>
          <Button
            type="button"
            className="h-12 w-full text-sm font-semibold uppercase tracking-wide md:w-auto md:min-w-[140px]"
            disabled={importing || !url.trim()}
            onClick={() => void handleStravaImport()}
          >
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>

        {stravaError ? (
          <p className="text-sm text-red-300" role="alert">
            {stravaError}
          </p>
        ) : null}
        {importError ? (
          <p className="text-sm text-red-300" role="alert">
            {importError}
          </p>
        ) : null}
        {importNotice ? (
          <p className="text-sm text-amber-200/90" role="status">
            {importNotice}
          </p>
        ) : null}

        {stravaOAuthConfigured && !stravaConnected && showStravaConnectHint ? (
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-4">
            <p className="text-sm text-white/90">Connect Strava to import real activities.</p>
            <Link
              href="/api/strava/oauth/start?next=%2Fraces%2Fnew"
              className="mt-3 inline-flex text-sm font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
            >
              Connect Strava
            </Link>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-6 md:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">How it works</p>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="flex gap-3 md:flex-1">
              <StepIcon done={activityImported}>1</StepIcon>
              <div>
                <p className="text-sm font-semibold text-white">Import activity</p>
                <p className="mt-0.5 text-xs text-muted">Paste a link and import.</p>
              </div>
            </div>
            <div className="flex gap-3 md:flex-1">
              <StepIcon done={matchStepActive}>2</StepIcon>
              <div>
                <p className="text-sm font-semibold text-white">Confirm race match</p>
                <p className="mt-0.5 text-xs text-muted">Pick the right event from our catalog.</p>
              </div>
            </div>
            <div className="flex gap-3 md:flex-1">
              <StepIcon done={Boolean(form.description?.trim())}>3</StepIcon>
              <div>
                <p className="text-sm font-semibold text-white">Add your story</p>
                <p className="mt-0.5 text-xs text-muted">Reflect and save below.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activityImported ? (
        <Card className="border-green/30 bg-green-950/20">
          <div className="grid gap-3 text-sm md:grid-cols-5">
            <p className="md:col-span-2">
              <span className="font-semibold text-green">Imported</span>
              <br />
              <span className="text-muted">
                {form.name || "—"}
                {form.date ? ` · ${form.date}` : ""}
              </span>
            </p>
            <p>
              <span className="text-muted">Distance</span>
              <br />
              {form.distance_km || "—"} km
            </p>
            <p>
              <span className="text-muted">Elevation</span>
              <br />
              {form.elevation_m || "—"} m
            </p>
            <p>
              <span className="text-muted">Moving time</span>
              <br />
              {form.time || "—"}
            </p>
          </div>
        </Card>
      ) : null}

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
              className="mt-3 min-h-44 w-full rounded-md border border-border bg-[#070b12] px-3 py-2 text-sm leading-relaxed text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-teal/50"
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
                        "linear-gradient(145deg, rgba(212,175,55,0.15) 0%, rgba(5,7,12,0.95) 45%, #05070c 100%)"
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
                className="text-teal hover:text-teal-hover hover:underline"
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
      <div className="mt-8">
        <RaceMatchConfirmation
          presentation="compact"
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
