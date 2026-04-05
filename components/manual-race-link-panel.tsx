"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmCanonicalStravaMatchAction, unlinkStravaCatalogFinishAction } from "@/lib/actions";
import type { ManualRaceSoftHint } from "@/lib/match-hub/manual-link-hints";
import type { SearchableRaceRow } from "@/lib/races/canonical/types";
import { confidenceFromScore100 } from "@/lib/strava-canonical-match/score-activity-canonical";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ManualRaceLinkActivityContext = {
  stravaActivityId: string;
  activityTitle: string;
  startDateYmd: string;
  distanceKm: number;
  elevationM: number | null;
};

function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}

function formatSurface(r: SearchableRaceRow): string | null {
  const s = r.surfaceType?.trim();
  return s || null;
}

function confidenceBarClass(conf: string): string {
  switch (conf) {
    case "high":
      return "bg-emerald-400";
    case "medium":
      return "bg-amber-400";
    default:
      return "bg-white/40";
  }
}

type Props = {
  ctx: ManualRaceLinkActivityContext;
  softSuggestions: ManualRaceSoftHint[];
  /** When set, parent handles submit (e.g. Match hub banner + refresh). */
  onConfirm?: (fd: FormData, stravaActivityId: string) => void;
  pending?: boolean;
  /** `hub` → My Races / queue refresh; `page` → activity story (JSON, no redirect). */
  responseMode: "hub" | "page";
  returnTo: string;
  onNotRace: () => void;
  onSnooze: () => void;
  /** Show unlink when a catalog finish already exists for this Strava id. */
  showUnlink?: boolean;
  /** After successful unlink (e.g. reopen linking UI on activity page). */
  onUnlinked?: () => void;
  className?: string;
  /** Mobile-first My Races: large primary actions, less explanatory copy. */
  compact?: boolean;
};

export function ManualRaceLinkPanel({
  ctx,
  softSuggestions,
  onConfirm,
  pending: pendingParent,
  responseMode,
  returnTo,
  onNotRace,
  onSnooze,
  showUnlink,
  onUnlinked,
  className,
  compact
}: Props) {
  const router = useRouter();
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchableRaceRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [localPending, startLocal] = useTransition();
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [unlinkPending, startUnlink] = useTransition();

  const pending = pendingParent || localPending;

  const topHint = softSuggestions[0] ?? null;
  const otherHints = useMemo(() => softSuggestions.slice(1), [softSuggestions]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 380);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!pickerOpen) return;
    const id = window.requestAnimationFrame(() => modalInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  const runSearch = useCallback(
    async (query: string) => {
      const qq = query.trim();
      if (qq.length < 2) {
        setHits(null);
        setSearchErr(null);
        return;
      }
      setSearching(true);
      setSearchErr(null);
      try {
        const params = new URLSearchParams({
          query: qq,
          limit: "24",
          activityDate: ctx.startDateYmd
        });
        const res = await fetch(`/api/races/canonical/search?${params.toString()}`);
        const body = (await res.json()) as { ok?: boolean; races?: SearchableRaceRow[]; error?: string };
        if (!res.ok || body.error) {
          setSearchErr(body.error ?? "Search failed.");
          setHits([]);
          return;
        }
        setHits(body.races ?? []);
      } catch {
        setSearchErr("Could not search.");
        setHits([]);
      } finally {
        setSearching(false);
      }
    },
    [ctx.startDateYmd]
  );

  useEffect(() => {
    if (!pickerOpen) return;
    if (debouncedQ.length >= 2) void runSearch(debouncedQ);
    else {
      setHits(null);
      setSearchErr(null);
    }
  }, [debouncedQ, runSearch, pickerOpen]);

  const openPicker = () => {
    setQ("");
    setHits(null);
    setSearchErr(null);
    setDebouncedQ("");
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
  };

  const statLine = useMemo(
    () =>
      [ctx.startDateYmd, ctx.distanceKm ? `${ctx.distanceKm} km` : null, ctx.elevationM != null ? `${Math.round(ctx.elevationM)} m` : null]
        .filter(Boolean)
        .join(" · "),
    [ctx.startDateYmd, ctx.distanceKm, ctx.elevationM]
  );

  const submitLink = (fd: FormData) => {
    fd.set("response_mode", responseMode);
    fd.set("return_to", returnTo);
    setLocalErr(null);
    if (onConfirm) {
      onConfirm(fd, ctx.stravaActivityId);
      return;
    }
    startLocal(async () => {
      try {
        const res = await confirmCanonicalStravaMatchAction(fd);
        if (res && typeof res === "object" && "error" in res && res.error) {
          setLocalErr(String(res.error));
          return;
        }
        closePicker();
        router.refresh();
      } catch (e: unknown) {
        if (isRedirectError(e)) throw e;
        setLocalErr(e instanceof Error ? e.message : "Could not save.");
      }
    });
  };

  const runUnlink = () => {
    if (!showUnlink) return;
    if (!window.confirm("Remove this finish from your profile? You can link it again afterward.")) return;
    startUnlink(async () => {
      setLocalErr(null);
      const fd = new FormData();
      fd.set("strava_activity_id", ctx.stravaActivityId);
      const res = await unlinkStravaCatalogFinishAction(fd);
      if (res && typeof res === "object" && "error" in res && res.error) {
        setLocalErr(String(res.error));
        return;
      }
      onUnlinked?.();
      router.refresh();
    });
  };

  const topConfidence = topHint ? confidenceFromScore100(topHint.score) : null;

  return (
    <Card className={cn("border border-white/12 bg-panel/35 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{compact ? "Review" : "Link to race"}</p>
          <p className="mt-1 font-semibold text-white">{ctx.activityTitle}</p>
          <p className="type-meta mt-1 text-sm text-muted">{statLine}</p>
        </div>
        {showUnlink ? (
          <Button type="button" variant="ghost" className="shrink-0 text-[10px] text-white/45 hover:text-amber-200" disabled={unlinkPending} onClick={runUnlink}>
            {unlinkPending ? "…" : "Unlink finish"}
          </Button>
        ) : null}
      </div>

      {localErr ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {localErr}
        </p>
      ) : null}

      {topHint ? (
        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-black/25 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Suggested race</p>
          <p className="text-lg font-medium leading-snug text-white">{topHint.name}</p>
          {topHint.subtitle ? <p className="text-sm text-white/50">{topHint.subtitle}</p> : null}
          {topConfidence ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Match confidence</p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", confidenceBarClass(topConfidence))}
                    style={{ width: `${Math.min(100, Math.max(0, topHint.score))}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] font-semibold capitalize text-white/70">{topConfidence}</span>
              </div>
            </>
          ) : null}
          <form
            className="pt-1"
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              submitLink(fd);
            }}
          >
            <input type="hidden" name="canonical_race_id" value={topHint.canonicalRaceId} />
            <input type="hidden" name="strava_activity_id" value={ctx.stravaActivityId} />
            <input type="hidden" name="date" value={ctx.startDateYmd} />
            <input type="hidden" name="distance_km" value={String(ctx.distanceKm)} />
            <input type="hidden" name="elevation_m" value={ctx.elevationM != null ? String(ctx.elevationM) : ""} />
            <Button type="submit" disabled={pending} className="min-h-[48px] w-full text-[13px] font-semibold uppercase tracking-[0.08em]">
              {pending ? "Saving…" : "Confirm race"}
            </Button>
          </form>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="min-h-[48px] w-full border-white/20 bg-white/[0.06] text-[13px] font-semibold uppercase tracking-[0.08em] text-white/90"
            onClick={openPicker}
          >
            Choose different race
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            className="min-h-[48px] w-full text-[13px] font-semibold uppercase tracking-[0.08em]"
            onClick={openPicker}
          >
            Choose different race
          </Button>
        </div>
      )}

      <div className={cn("mt-4 flex flex-col gap-2", compact ? "" : "sm:flex-row sm:flex-wrap sm:items-center sm:gap-3")}>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className={cn(
            "min-h-[48px] border-white/20 bg-white/[0.06] text-[13px] font-semibold uppercase tracking-[0.08em]",
            compact ? "w-full" : ""
          )}
          onClick={onNotRace}
        >
          Not a race
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className={cn("min-h-[44px] text-white/70", compact ? "w-full" : "")}
          onClick={onSnooze}
        >
          Save for later
        </Button>
        <Link
          href="/races/find"
          className={cn(
            "inline-flex min-h-[44px] items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-teal hover:text-teal-hover hover:underline",
            compact ? "w-full" : ""
          )}
        >
          Browse library
        </Link>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4" aria-labelledby="race-picker-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={closePicker}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-white/12 bg-[#0b0f18] shadow-2xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <h2 id="race-picker-title" className="text-sm font-semibold text-white">
                Choose a race
              </h2>
              <button
                type="button"
                className="min-h-[40px] min-w-[40px] rounded-lg text-[13px] text-white/60 hover:bg-white/10 hover:text-white"
                onClick={closePicker}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <Input
                ref={modalInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Race name…"
                className="h-12 border-white/15 bg-black/40 text-white placeholder:text-white/35"
                autoComplete="off"
                aria-label="Search races"
                aria-describedby={searchErr ? "race-picker-search-err" : undefined}
              />

              {otherHints.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Other suggestions</p>
                  <ul className="mt-2 space-y-2">
                    {otherHints.map((h) => (
                      <li key={h.canonicalRaceId} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white">{h.name}</p>
                            {h.subtitle ? <p className="type-meta mt-1 text-[11px] text-muted">{h.subtitle}</p> : null}
                          </div>
                          <form
                            onSubmit={(ev) => {
                              ev.preventDefault();
                              const fd = new FormData(ev.currentTarget);
                              submitLink(fd);
                            }}
                          >
                            <input type="hidden" name="canonical_race_id" value={h.canonicalRaceId} />
                            <input type="hidden" name="strava_activity_id" value={ctx.stravaActivityId} />
                            <input type="hidden" name="date" value={ctx.startDateYmd} />
                            <input type="hidden" name="distance_km" value={String(ctx.distanceKm)} />
                            <input type="hidden" name="elevation_m" value={ctx.elevationM != null ? String(ctx.elevationM) : ""} />
                            <Button type="submit" disabled={pending} className="text-[11px]">
                              Confirm race
                            </Button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5">
                {searching ? <p className="text-xs text-white/45">Searching…</p> : null}
                {searchErr ? (
                  <p id="race-picker-search-err" className="text-xs text-amber-200/90">
                    {searchErr}
                  </p>
                ) : null}
                {hits && hits.length === 0 && debouncedQ.length >= 2 && !searching ? (
                  <p className="text-xs text-white/45">No results.</p>
                ) : null}
                {hits && hits.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {hits.map((r) => {
                      const surf = formatSurface(r);
                      return (
                        <li key={r.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white">{r.name}</p>
                              <p className="type-meta mt-1 text-[12px] text-white/55">
                                {r.locationLabel}
                                {" · "}
                                {formatDistanceKm(r.distanceKm)}
                                {r.elevationGainM != null && r.elevationGainM > 0 ? ` · ${Math.round(r.elevationGainM)} m` : ""}
                              </p>
                              <p className="type-meta mt-1 text-[11px] text-white/40">
                                {r.dateSummary}
                                {surf ? ` · ${surf}` : ""}
                                {r.raceType ? ` · ${r.raceType}` : ""}
                              </p>
                            </div>
                            <form
                              className="shrink-0"
                              onSubmit={(ev) => {
                                ev.preventDefault();
                                const fd = new FormData(ev.currentTarget);
                                submitLink(fd);
                              }}
                            >
                              <input type="hidden" name="canonical_race_id" value={r.id} />
                              <input type="hidden" name="strava_activity_id" value={ctx.stravaActivityId} />
                              <input type="hidden" name="date" value={ctx.startDateYmd} />
                              <input type="hidden" name="distance_km" value={String(ctx.distanceKm)} />
                              <input type="hidden" name="elevation_m" value={ctx.elevationM != null ? String(ctx.elevationM) : ""} />
                              <Button type="submit" disabled={pending} className="text-[11px]">
                                Confirm race
                              </Button>
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
