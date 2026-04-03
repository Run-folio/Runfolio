"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmCustomMajorEffortAction,
  confirmKnownRaceMatchAction,
  dismissStravaProfileCandidateAction
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfilePendingRaceCandidate, RaceMatchCandidate } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  candidates: ProfilePendingRaceCandidate[];
  /** Safe relative path e.g. `/alice` */
  profilePath: string;
};

function confidenceLabel(c: ProfilePendingRaceCandidate["confidence"]): string {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium confidence";
  if (c === "low") return "Low confidence";
  return "Unmatched";
}

function buildConfirmFd(
  discoverRaceId: string,
  m: ProfilePendingRaceCandidate,
  profilePath: string,
  completeBucket: boolean
): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", discoverRaceId);
  fd.set("strava_activity_id", m.stravaId);
  if (completeBucket && m.userRaceId) fd.set("target_user_race_id", m.userRaceId);
  fd.set("date", m.date);
  fd.set("distance_km", String(m.distanceKm));
  fd.set("elevation_m", m.elevationM != null ? String(Math.round(m.elevationM)) : "");
  fd.set("time", m.movingTimeLabel);
  fd.set("location", m.location);
  fd.set("description", "");
  fd.set("return_to", profilePath);
  return fd;
}

function buildConfirmFdFromCandidate(
  discoverRaceId: string,
  alt: RaceMatchCandidate,
  m: ProfilePendingRaceCandidate,
  profilePath: string,
  completeBucket: boolean
): FormData {
  const fd = new FormData();
  fd.set("discover_race_id", discoverRaceId);
  fd.set("strava_activity_id", m.stravaId);
  if (completeBucket && alt.userRaceId) fd.set("target_user_race_id", alt.userRaceId);
  fd.set("date", m.date);
  fd.set("distance_km", String(m.distanceKm));
  fd.set("elevation_m", m.elevationM != null ? String(Math.round(m.elevationM)) : "");
  fd.set("time", m.movingTimeLabel);
  fd.set("location", m.location);
  fd.set("description", "");
  fd.set("return_to", profilePath);
  return fd;
}

function buildCustomMajorFd(
  m: ProfilePendingRaceCandidate,
  customName: string,
  profilePath: string
): FormData {
  const fd = new FormData();
  fd.set("strava_activity_id", m.stravaId);
  fd.set("custom_name", customName.trim() || m.activityTitle || "Major trail / ultra effort");
  fd.set("date", m.date);
  fd.set("distance_km", String(m.distanceKm));
  fd.set("elevation_m", m.elevationM != null ? String(Math.round(m.elevationM)) : "");
  fd.set("time", m.movingTimeLabel);
  fd.set("location", m.location);
  fd.set("return_to", profilePath);
  return fd;
}

export function ProfilePendingRaceCandidates({ candidates: initial, profilePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openAlt, setOpenAlt] = useState<string | null>(null);
  const [customUltraNames, setCustomUltraNames] = useState<Record<string, string>>({});

  if (initial.length === 0) return null;

  const runConfirm = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await confirmKnownRaceMatchAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
    });
  };

  const runCustomMajor = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await confirmCustomMajorEffortAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) setError(String(res.error));
    });
  };

  const runDismiss = (stravaId: string) => {
    setError(null);
    const fd = new FormData();
    fd.set("strava_activity_id", stravaId);
    fd.set("return_to", profilePath);
    startTransition(async () => {
      const res = await dismissStravaProfileCandidateAction(fd);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="border-x border-b border-amber-500/30 bg-gradient-to-b from-amber-950/25 to-[#080a0e] px-5 py-8 md:px-8 md:py-10">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">Pending review</p>
      <h2 className="type-section mt-2 text-lg text-white md:text-xl">Imported major race efforts</h2>
      <p className="type-meta mt-2 max-w-2xl text-sm">
        Approve what belongs on your public portfolio. Nothing here appears in Top Races or Race Journey until you confirm.
        Dismiss efforts that aren&apos;t meaningful races for your story.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-6 space-y-5">
        {initial.map((m) => (
          <li key={m.stravaId} className="border border-white/10 bg-black/40 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  m.confidence === "high"
                    ? "border-green-500/45 bg-green-500/10 text-green-200"
                    : m.confidence === "medium"
                      ? "border-amber-500/45 bg-amber-500/10 text-amber-100"
                      : m.confidence === "low"
                        ? "border-white/20 text-muted"
                        : "border-white/15 text-muted"
                )}
              >
                {confidenceLabel(m.confidence)}
              </span>
              {m.suggestedDisplayTitle ? (
                <span className="text-[10px] text-muted">
                  Suggested: <span className="text-accent">{m.suggestedDisplayTitle}</span>
                </span>
              ) : (
                <span className="text-[10px] text-muted">No automatic catalog match — pick a race below</span>
              )}
            </div>

            <p className="mt-3 font-semibold text-white">{m.activityTitle}</p>
            <dl className="mt-2 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted">Date</dt>
                <dd className="text-white/90">{m.date}</dd>
              </div>
              <div>
                <dt className="text-muted">Distance</dt>
                <dd className="text-white/90">{m.distanceKm} km</dd>
              </div>
              <div>
                <dt className="text-muted">Elevation</dt>
                <dd className="text-white/90">{m.elevationM != null ? `${m.elevationM} m` : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Type</dt>
                <dd className="text-white/90">{m.sportType ?? m.activityType ?? "—"}</dd>
              </div>
            </dl>
            {m.reasons.length > 0 ? (
              <ul className="mt-3 list-inside list-disc text-[11px] text-muted">
                {m.reasons.slice(0, 5).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            {m.onUserBucketList ? (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gold">On your bucket list</p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {m.suggestedDiscoverId ? (
                <>
                  {m.onUserBucketList && m.userRaceId ? (
                    <Button
                      type="button"
                      disabled={pending}
                      className="bg-green-800 hover:bg-green-700"
                      onClick={() =>
                        runConfirm(buildConfirmFd(m.suggestedDiscoverId!, m, profilePath, true))
                      }
                    >
                      Confirm for profile · complete bucket
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => runConfirm(buildConfirmFd(m.suggestedDiscoverId!, m, profilePath, false))}
                  >
                    Confirm for profile
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="secondary" disabled={pending} onClick={() => runDismiss(m.stravaId)}>
                Not this race
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpenAlt((prev) => (prev === m.stravaId ? null : m.stravaId))}
              >
                {openAlt === m.stravaId ? "Hide options" : "Choose another race"}
              </Button>
              <Link
                href={`/activities/${m.stravaId}`}
                className="inline-flex items-center justify-center rounded-[12px] border border-white/15 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/30 hover:text-white"
              >
                View activity
              </Link>
            </div>

            {openAlt === m.stravaId && m.alternatives.length > 0 ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Other catalog matches</p>
                <ul className="mt-3 space-y-2">
                  {m.alternatives.map((alt) => (
                    <li
                      key={alt.discoverRaceId}
                      className="flex flex-col gap-2 border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{alt.title}</p>
                        <p className="text-[10px] text-muted">
                          {alt.confidence} · score {(alt.score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {alt.onUserBucketList && alt.userRaceId ? (
                          <Button
                            type="button"
                            disabled={pending}
                            className="bg-green-800 px-3 py-1.5 text-[11px] hover:bg-green-700"
                            onClick={() =>
                              runConfirm(buildConfirmFdFromCandidate(alt.discoverRaceId, alt, m, profilePath, true))
                            }
                          >
                            Confirm + bucket
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          disabled={pending}
                          className="px-3 py-1.5 text-[11px]"
                          onClick={() =>
                            runConfirm(buildConfirmFdFromCandidate(alt.discoverRaceId, alt, m, profilePath, false))
                          }
                        >
                          Confirm for profile
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {openAlt === m.stravaId && m.alternatives.length === 0 ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-muted">
                No catalog matches pass our threshold. Use{" "}
                <Link href="/races/new" className="text-accent underline-offset-4 hover:underline">
                  Add race
                </Link>{" "}
                to link manually or browse the{" "}
                <Link href="/races/find" className="text-accent underline-offset-4 hover:underline">
                  race library
                </Link>
                .
              </p>
            ) : null}

            {m.distanceKm >= 50 ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                  Not in the catalog?
                </p>
                <p className="mt-1 text-xs text-muted">
                  Save this ≥50 km effort as a named finish without a catalog id — you can link a known race later.
                </p>
                <div className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
                  <Input
                    value={
                      customUltraNames[m.stravaId] !== undefined
                        ? customUltraNames[m.stravaId]
                        : (m.activityTitle ?? "")
                    }
                    onChange={(e) =>
                      setCustomUltraNames((prev) => ({ ...prev, [m.stravaId]: e.target.value }))
                    }
                    placeholder="Display name (optional)"
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runCustomMajor(
                        buildCustomMajorFd(
                          m,
                          customUltraNames[m.stravaId] !== undefined
                            ? customUltraNames[m.stravaId]
                            : (m.activityTitle ?? ""),
                          profilePath
                        )
                      )
                    }
                  >
                    Save as custom ultra
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
