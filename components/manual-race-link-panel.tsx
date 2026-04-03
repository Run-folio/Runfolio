"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { confirmCanonicalStravaMatchAction, unlinkStravaCatalogFinishAction } from "@/lib/actions";
import type { ManualRaceSoftHint } from "@/lib/match-hub/manual-link-hints";
import type { SearchableRaceRow } from "@/lib/races/canonical/types";
import { CANONICAL_SUGGESTED_HIGH_MIN_SCORE } from "@/lib/strava-canonical-match/match-policy";
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

type Props = {
  ctx: ManualRaceLinkActivityContext;
  softSuggestions: ManualRaceSoftHint[];
  /** When set, parent handles submit (e.g. Match hub banner + refresh). */
  onConfirm?: (fd: FormData, stravaActivityId: string) => void;
  pending?: boolean;
  /** `hub` → Match & Import; `page` → activity story (JSON, no redirect). */
  responseMode: "hub" | "page";
  returnTo: string;
  onNotRace: () => void;
  onSnooze: () => void;
  /** Show unlink when a catalog finish already exists for this Strava id. */
  showUnlink?: boolean;
  /** After successful unlink (e.g. reopen linking UI on activity page). */
  onUnlinked?: () => void;
  className?: string;
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
  className
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchableRaceRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [localPending, startLocal] = useTransition();
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [unlinkPending, startUnlink] = useTransition();

  const pending = pendingParent || localPending;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 380);
    return () => window.clearTimeout(t);
  }, [q]);

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
    if (debouncedQ.length >= 2) void runSearch(debouncedQ);
    else {
      setHits(null);
      setSearchErr(null);
    }
  }, [debouncedQ, runSearch]);

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

  return (
    <Card className={cn("border border-white/12 bg-panel/35 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Link to race</p>
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

      {softSuggestions.length > 0 ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Possible matches</p>
          <p className="type-meta mt-1 text-xs text-white/45">
            Based on your activity date, distance, and location — under {CANONICAL_SUGGESTED_HIGH_MIN_SCORE}% so we don&apos;t auto-claim. Pick one only if
            it&apos;s correct.
          </p>
          <ul className="mt-3 space-y-3">
            {softSuggestions.map((h) => (
              <li key={h.canonicalRaceId} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{h.name}</p>
                    <p className="type-meta mt-1 text-[11px] text-muted">{h.subtitle}</p>
                    <p className="mt-1 text-[10px] tabular-nums text-white/40">Rough fit · {Math.round(h.score)}%</p>
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
                    <Button type="submit" disabled={pending} className="text-[10px]">
                      Use this race
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Search verified catalog</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Race name, city, country, or abbreviation…"
            className="max-w-lg border-white/15 bg-black/40"
            aria-label="Search races"
          />
          <Button type="button" variant="secondary" disabled={pending || searching} onClick={() => void runSearch(q)}>
            {searching ? "…" : "Search"}
          </Button>
        </div>
        <p className="text-[11px] text-white/35">Results favor editions near your activity date (±3 weeks).</p>
        {searchErr ? <p className="text-xs text-amber-200/90">{searchErr}</p> : null}
        {hits && hits.length === 0 && debouncedQ.length >= 2 && !searching ? (
          <p className="text-xs text-white/45">No hits — try another spelling or browse the full library.</p>
        ) : null}
        {hits && hits.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {hits.map((r) => {
              const surf = formatSurface(r);
              return (
                <li key={r.id} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
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
                      <Button type="submit" disabled={pending} className="text-[10px]">
                        Link finish
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[11px]">
        <Button type="button" variant="ghost" disabled={pending} className="text-white/55" onClick={onNotRace}>
          Not a race
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onSnooze}>
          Save for later
        </Button>
        <Link href="/races/find" className="font-semibold uppercase tracking-wider text-accent hover:underline">
          Browse library
        </Link>
        <span className="text-white/30">·</span>
        <span className="text-white/40">Can&apos;t find your event? Library search may still list it under another name.</span>
      </div>
    </Card>
  );
}
