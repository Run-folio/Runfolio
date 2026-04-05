"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  confirmCustomMajorEffortAction,
  confirmKnownRaceMatchAction,
  dismissStravaProfileCandidateAction
} from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfilePendingRaceCandidate, RaceMatchCandidate } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  candidates: ProfilePendingRaceCandidate[];
  /** `return_to` for server actions after confirm / dismiss / custom ultra */
  returnTo: string;
};

const compactBtn =
  "min-h-8 shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] sm:min-h-9 sm:px-3 sm:text-[11px]";

function buildConfirmFd(
  discoverRaceId: string,
  m: ProfilePendingRaceCandidate,
  returnTo: string,
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
  fd.set("return_to", returnTo);
  return fd;
}

function buildConfirmFdFromCandidate(
  discoverRaceId: string,
  alt: RaceMatchCandidate,
  m: ProfilePendingRaceCandidate,
  returnTo: string,
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
  fd.set("return_to", returnTo);
  return fd;
}

function buildCustomMajorFd(m: ProfilePendingRaceCandidate, customName: string, returnTo: string): FormData {
  const fd = new FormData();
  fd.set("strava_activity_id", m.stravaId);
  fd.set("custom_name", customName.trim() || m.activityTitle || "Major trail / ultra effort");
  fd.set("date", m.date);
  fd.set("distance_km", String(m.distanceKm));
  fd.set("elevation_m", m.elevationM != null ? String(Math.round(m.elevationM)) : "");
  fd.set("time", m.movingTimeLabel);
  fd.set("location", m.location);
  fd.set("return_to", returnTo);
  return fd;
}

export function ProfilePendingRaceCandidates({ candidates: initial, returnTo }: Props) {
  const router = useRouter();
  const listLabelId = useId();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openAlt, setOpenAlt] = useState<string | null>(null);
  const [customUltraNames, setCustomUltraNames] = useState<Record<string, string>>({});

  if (initial.length === 0) return null;

  const runConfirm = (fd: FormData) => {
    if (!persistenceAvailable) {
      setError(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmKnownRaceMatchAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) setError(res.error);
    });
  };

  const runCustomMajor = (fd: FormData) => {
    if (!persistenceAvailable) {
      setError(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmCustomMajorEffortAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) setError(String(res.error));
    });
  };

  const runDismiss = (stravaId: string) => {
    if (!persistenceAvailable) {
      setError(persistenceReason ?? "Saving isn’t available.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("strava_activity_id", stravaId);
    fd.set("return_to", returnTo);
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
    <section
      id="catalog-pending-review"
      data-section="catalog-pending-review"
      aria-labelledby={listLabelId}
      className="space-y-2"
    >
      <h2 id={listLabelId} className="sr-only">
        Catalog matches to confirm for your profile
      </h2>
      {!persistenceAvailable ? (
        <p
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90"
          role="status"
        >
          {persistenceReason ?? "Database not connected — confirm and dismiss actions are disabled."}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-1.5">
        {initial.map((m) => (
          <li
            key={m.stravaId}
            className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 sm:px-3 sm:py-2.5"
          >
            <p className="text-[13px] font-medium leading-snug text-white">{m.activityTitle}</p>
            <p className="mt-0.5 text-[10px] tabular-nums leading-snug text-white/60">
              <span>{m.date}</span>
              <span className="text-white/30"> · </span>
              <span>{m.distanceKm} km</span>
              <span className="text-white/30"> · </span>
              <span>{m.elevationM != null ? `${m.elevationM} m` : "—"}</span>
              <span className="text-white/30"> · </span>
              <span>{m.sportType ?? m.activityType ?? "—"}</span>
            </p>
            {m.suggestedDisplayTitle ? (
              <p className="mt-1 text-[10px] leading-snug text-muted">
                Suggested:&nbsp;
                <span className="text-white/78">{m.suggestedDisplayTitle}</span>
              </p>
            ) : null}
            {m.onUserBucketList ? (
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">On bucket list</p>
            ) : null}

            <div className="mt-1.5 flex flex-wrap gap-1">
              {m.suggestedDiscoverId ? (
                <>
                  {m.onUserBucketList && m.userRaceId ? (
                    <Button
                      type="button"
                      disabled={pending || !persistenceAvailable}
                      className={cn(compactBtn, "bg-green-800 hover:bg-green-700")}
                      onClick={() => runConfirm(buildConfirmFd(m.suggestedDiscoverId!, m, returnTo, true))}
                    >
                      Confirm + bucket
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    disabled={pending || !persistenceAvailable}
                    className={cn(compactBtn, "bg-accent text-white hover:bg-gold-hover")}
                    onClick={() => runConfirm(buildConfirmFd(m.suggestedDiscoverId!, m, returnTo, false))}
                  >
                    Confirm match
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !persistenceAvailable}
                className={compactBtn}
                onClick={() => runDismiss(m.stravaId)}
              >
                Not this race
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending || !persistenceAvailable}
                className={cn(compactBtn, "text-white/85 hover:bg-white/[0.08]")}
                onClick={() => setOpenAlt((prev) => (prev === m.stravaId ? null : m.stravaId))}
              >
                Choose another race
              </Button>
              <Link
                href={`/activities/${m.stravaId}`}
                className={cn(
                  compactBtn,
                  "inline-flex items-center justify-center rounded-[10px] border border-white/16 text-white/78 transition hover:border-white/28 hover:text-white"
                )}
              >
                View activity
              </Link>
            </div>

            {openAlt === m.stravaId && m.alternatives.length > 0 ? (
              <div className="mt-1.5 border-t border-white/10 pt-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Other matches</p>
                <ul className="mt-1 space-y-1">
                  {m.alternatives.map((alt) => (
                    <li
                      key={alt.discoverRaceId}
                      className="flex flex-col gap-1 rounded-md border border-white/10 bg-black/25 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-white">{alt.title}</p>
                        <p className="text-[9px] text-muted">
                          {alt.confidence} · {(alt.score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {alt.onUserBucketList && alt.userRaceId ? (
                          <Button
                            type="button"
                            disabled={pending || !persistenceAvailable}
                            className={cn(compactBtn, "bg-green-800 hover:bg-green-700")}
                            onClick={() =>
                              runConfirm(buildConfirmFdFromCandidate(alt.discoverRaceId, alt, m, returnTo, true))
                            }
                          >
                            Confirm + bucket
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          disabled={pending || !persistenceAvailable}
                          className={compactBtn}
                          onClick={() =>
                            runConfirm(buildConfirmFdFromCandidate(alt.discoverRaceId, alt, m, returnTo, false))
                          }
                        >
                          Confirm match
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {openAlt === m.stravaId && m.alternatives.length === 0 ? (
              <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] leading-snug text-muted">
                No other catalog matches.&nbsp;
                <Link
                  href="/my-races?tab=review"
                  className="text-teal underline-offset-2 hover:text-teal-hover hover:underline"
                >
                  My Races
                </Link>
                ,{" "}
                <Link href="/races/new" className="text-teal underline-offset-2 hover:text-teal-hover hover:underline">
                  Add race
                </Link>
                , or{" "}
                <Link href="/races/find" className="text-teal underline-offset-2 hover:text-teal-hover hover:underline">
                  Find a race
                </Link>
                .
              </p>
            ) : null}

            {m.distanceKm >= 50 ? (
              <div className="mt-1.5 border-t border-white/10 pt-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/48">Custom major (≥50 km)</p>
                <div className="mt-1 flex max-w-lg flex-col gap-1 sm:flex-row sm:items-end">
                  <Input
                    value={
                      customUltraNames[m.stravaId] !== undefined
                        ? customUltraNames[m.stravaId]
                        : (m.activityTitle ?? "")
                    }
                    onChange={(e) => setCustomUltraNames((prev) => ({ ...prev, [m.stravaId]: e.target.value }))}
                    placeholder="Display name"
                    className="h-8 text-[13px] sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !persistenceAvailable}
                    className={compactBtn}
                    onClick={() =>
                      runCustomMajor(
                        buildCustomMajorFd(
                          m,
                          customUltraNames[m.stravaId] !== undefined
                            ? customUltraNames[m.stravaId]
                            : (m.activityTitle ?? ""),
                          returnTo
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
