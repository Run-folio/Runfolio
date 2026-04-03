"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  confirmCanonicalStravaMatchAction,
  dismissCanonicalStravaMatchAction,
  markStravaActivityNotRaceAction,
  snoozeStravaActivityMatchHubAction,
  unsnoozeStravaActivityMatchHubAction
} from "@/lib/actions";
import type { MatchHubBundle } from "@/lib/match-hub/service";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import type { SearchableRaceRow } from "@/lib/races/canonical/types";
import type { StravaSyncedActivityRow } from "@/lib/strava-sync/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildSetupUrl } from "@/lib/setup-url";
import { cn } from "@/lib/utils";

type Props = {
  initialBundle: MatchHubBundle;
  profileHref: string;
  completedRacesHref: string;
  /** Optional profile URL with celebration query (e.g. after other flows) */
  profileFinishHref: string;
  stravaOAuthConfigured: boolean;
  /** Live Strava list length when the feed loaded (same session). Used so empty copy isn’t misleading vs Overview. */
  liveStravaActivityCount?: number | null;
};

function activityMeta(s: CanonicalStravaSuggestion | StravaSyncedActivityRow) {
  if ("activityTitle" in s) {
    return {
      title: s.activityTitle,
      date: s.startDateYmd,
      km: s.distanceKm,
      el: s.elevationM,
      id: s.stravaActivityId
    };
  }
  return {
    title: s.name,
    date: s.start_date.slice(0, 10),
    km: s.distance_km ?? 0,
    el: s.elevation_gain_m,
    id: s.strava_activity_id
  };
}

function HubEmpty({
  title,
  body,
  icon = "—",
  children,
  className
}: {
  title: string;
  body: string;
  icon?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/10 bg-gradient-to-b from-[#0a0d14]/90 to-[#06080c]/90 px-6 py-14 text-center md:px-10",
        className
      )}
    >
      <p className="font-display text-3xl font-light text-white/20" aria-hidden>
        {icon}
      </p>
      <p className="mt-5 font-display text-xl font-normal tracking-tight text-white/90">{title}</p>
      <p className="type-meta mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">{body}</p>
      {children ? <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}

export function MatchHubClient({
  initialBundle,
  profileHref,
  completedRacesHref,
  profileFinishHref,
  stravaOAuthConfigured,
  liveStravaActivityCount
}: Props) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const { suggestedHigh, unmatched, snoozed, recentlyConfirmed, totalSyncedCount } = initialBundle;

  const serverQueueSize = useMemo(
    () =>
      initialBundle.suggestedHigh.length + initialBundle.unmatched.length + initialBundle.snoozed.length,
    [initialBundle]
  );

  const showHubQuietExplainer =
    hiddenIds.size === 0 &&
    serverQueueSize === 0 &&
    initialBundle.recentlyConfirmed.length === 0;

  useEffect(() => {
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set<string>([
        ...suggestedHigh.map((s) => s.stravaActivityId),
        ...unmatched.map((u) => u.row.strava_activity_id)
      ]);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [suggestedHigh, unmatched]);

  const hideId = (stravaActivityId: string) => {
    setHiddenIds((prev) => new Set(prev).add(stravaActivityId));
  };

  const unhideId = (stravaActivityId: string) => {
    setHiddenIds((prev) => {
      const n = new Set(prev);
      n.delete(stravaActivityId);
      return n;
    });
  };

  const dismiss = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await dismissCanonicalStravaMatchAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({
          kind: "ok",
          text: "That suggestion is cleared. The same activity can still be matched manually if it really was a race."
        });
        router.refresh();
      }
    });
  };

  const notRace = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await markStravaActivityNotRaceAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({ kind: "ok", text: "Marked as training — it won’t show in this queue anymore." });
        router.refresh();
      }
    });
  };

  const snooze = (stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      const r = await snoozeStravaActivityMatchHubAction(fd);
      if ("error" in r && r.error) {
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: String(r.error) });
      } else {
        setBanner({ kind: "ok", text: "Saved for later — scroll down to bring it back anytime." });
        router.refresh();
      }
    });
  };

  const unsnooze = (stravaActivityId: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set("strava_activity_id", stravaActivityId);
      await unsnoozeStravaActivityMatchHubAction(fd);
      router.refresh();
    });
  };

  const confirmMatch = (fd: FormData, stravaActivityId: string) => {
    hideId(stravaActivityId);
    start(async () => {
      setBanner(null);
      fd.set("response_mode", "hub");
      fd.set("return_to", "/matches");
      try {
        const res = await confirmCanonicalStravaMatchAction(fd);
        if (res && typeof res === "object" && "error" in res && res.error) {
          unhideId(stravaActivityId);
          setBanner({ kind: "err", text: String(res.error) });
          return;
        }
        if (res && typeof res === "object" && "ok" in res && res.ok) {
          setBanner({
            kind: "ok",
            text: "This finish is saved and published on your portfolio. Open your profile or jump straight to completed races."
          });
          router.refresh();
        }
      } catch (e: unknown) {
        if (isRedirectError(e)) throw e;
        unhideId(stravaActivityId);
        setBanner({ kind: "err", text: "Something went wrong — try again." });
      }
    });
  };

  const filteredHigh = useMemo(
    () => suggestedHigh.filter((s) => !hiddenIds.has(s.stravaActivityId)),
    [suggestedHigh, hiddenIds]
  );
  const filteredUnmatched = useMemo(
    () => unmatched.filter((u) => !hiddenIds.has(u.row.strava_activity_id)),
    [unmatched, hiddenIds]
  );

  const counts = useMemo(
    () => ({
      hi: filteredHigh.length,
      un: filteredUnmatched.length,
      snz: snoozed.length
    }),
    [filteredHigh.length, filteredUnmatched.length, snoozed.length]
  );

  return (
    <div className="space-y-20">
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-2xl border px-6 py-6 shadow-xl transition-all",
            banner.kind === "ok"
              ? "border-emerald-400/35 bg-gradient-to-br from-emerald-950/50 to-[#0a1210] shadow-emerald-950/30"
              : "border-red-400/35 bg-red-950/25 shadow-red-950/20"
          )}
        >
          {banner.kind === "ok" ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl text-emerald-200"
                aria-hidden
              >
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-normal text-emerald-50">You&apos;re set</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100/85">{banner.text}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href={profileHref}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500/90 px-5 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0a1210] transition hover:bg-emerald-400"
                  >
                    Your profile
                  </Link>
                  <Link
                    href={completedRacesHref}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/20 px-5 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-emerald-50 transition hover:border-emerald-300/55 hover:bg-emerald-900/30"
                  >
                    Completed races
                  </Link>
                  <Link
                    href={profileFinishHref}
                    className="inline-flex items-center justify-center text-center text-[11px] font-medium text-emerald-200/70 underline-offset-4 hover:text-emerald-100 hover:underline sm:self-center"
                  >
                    Profile with finish highlight →
                  </Link>
                </div>
                <button
                  type="button"
                  className="mt-4 text-left text-[11px] text-white/40 hover:text-white/60"
                  onClick={() => setBanner(null)}
                >
                  Dismiss message
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium text-red-200/95">{banner.text}</p>
              <button type="button" className="mt-3 text-[11px] text-red-200/60 hover:text-red-100" onClick={() => setBanner(null)}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      ) : null}

      {!stravaOAuthConfigured ? (
        <Card className="border-amber-500/25 bg-amber-950/15 p-5 text-sm text-amber-100/85">
          Strava OAuth isn&apos;t configured here (<code className="rounded bg-black/35 px-1 text-xs">STRAVA_CLIENT_ID</code> /{" "}
          <code className="rounded bg-black/35 px-1 text-xs">SECRET</code>), so activities won&apos;t import automatically.
          You can still add finishes from{" "}
          <Link href="/races/find" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Find a race
          </Link>{" "}
          or{" "}
          <Link href="/races/new" className="font-medium text-amber-200 underline-offset-4 hover:underline">
            Add a race manually
          </Link>
          .
        </Card>
      ) : null}

      {showHubQuietExplainer ? (
        <Card className="border border-white/12 bg-[#0a1018] p-5 text-sm leading-relaxed text-white/70">
          {totalSyncedCount === 0 ? (
            <>
              <p className="font-medium text-white/90">
                {liveStravaActivityCount != null && liveStravaActivityCount > 0
                  ? "Strava is live, but nothing is saved in Runfolio yet"
                  : "No Strava activities saved in Runfolio yet"}
              </p>
              <p className="mt-2">
                {liveStravaActivityCount != null && liveStravaActivityCount > 0 ? (
                  <>
                    Overview may show a live Strava preview, but Match &amp; Import only reads what you{" "}
                    <strong className="text-white/90">sync</strong> into your account. Use{" "}
                    <strong className="text-white/90">Sync from Strava</strong> in the header to store summaries here.
                  </>
                ) : stravaOAuthConfigured ? (
                  "Run Sync from Strava in the header after your next long run or race. We only surface efforts that look event-sized once they’re stored — not from a preview alone."
                ) : (
                  "On this deployment, Strava sync can’t run without OAuth keys. Use the links in the amber notice above, or try again in an environment where Strava is configured."
                )}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-white/90">You&apos;re caught up</p>
              <p className="mt-2">
                <strong className="text-white/85">{totalSyncedCount}</strong> Strava activit
                {totalSyncedCount === 1 ? "y" : "ies"} saved — nothing is waiting for a strong match or manual link. New
                race-sized syncs will surface here when they qualify.
              </p>
            </>
          )}
        </Card>
      ) : null}

      <section className="space-y-6">
        <header>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/90">Suggested matches</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm text-white/55">
            Strong matches only: <strong className="font-medium text-white/75">80%+</strong> fit to the verified catalog.
            Weaker overlaps are never suggested here — use manual linking instead.
          </p>
        </header>
        {counts.hi === 0 ? (
          <HubEmpty
            icon="◇"
            title={totalSyncedCount === 0 ? "Nothing saved to match yet" : "No strong matches found"}
            body={
              totalSyncedCount === 0
                ? "Sync from Strava stores activities in Runfolio first. Strong suggestions need saved rows plus an 80%+ catalog fit."
                : "None of your saved race-sized activities reached the 80% confidence bar — that is common when titles, dates, or geography do not line up tightly. You can link your finish to a verified race manually below."
            }
            className={totalSyncedCount > 0 && counts.hi === 0 ? "border-gold/15 bg-gradient-to-b from-gold/[0.04] to-[#06080c]/90" : undefined}
          >
            <Link
              href="#hub-unmatched"
              className="rounded-xl border border-white/18 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/85 transition hover:border-white/30 hover:text-white"
            >
              Manual linking
            </Link>
            <SyncHint stravaOAuthConfigured={stravaOAuthConfigured} />
          </HubEmpty>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {filteredHigh.map((s) => (
              <HighConfidenceCard
                key={s.stravaActivityId}
                s={s}
                pending={pending}
                onConfirm={confirmMatch}
                onDismiss={dismiss}
                onSnooze={snooze}
              />
            ))}
          </ul>
        )}
      </section>

      <section id="hub-unmatched" className="scroll-mt-24 space-y-6">
        <header>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Manual linking</h2>
          <p className="type-meta mt-2 max-w-2xl text-sm text-white/55">
            Race-sized Strava efforts without an 80%+ automatic match. Search the verified library and link the finish you
            actually ran — the trustworthy path when we don&apos;t suggest one.
          </p>
        </header>
        {counts.un === 0 ? (
          <HubEmpty
            icon="○"
            title="No unmatched race-like efforts"
            body={
              totalSyncedCount === 0
                ? "Sync stores race-sized efforts here first — then unmatched long runs show up for manual linking."
                : "Every saved race-sized row is linked, has a strong suggestion above, was excluded, or didn’t pass the race-like flag."
            }
          >
            <Link href="/races/find" className="text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline">
              Browse verified races
            </Link>
          </HubEmpty>
        ) : (
          <ul className="space-y-4">
            {filteredUnmatched.map(({ row }) => (
              <li key={row.strava_activity_id}>
                <UnmatchedCard
                  row={row}
                  pending={pending}
                  onConfirm={confirmMatch}
                  onNotRace={() => notRace(row.strava_activity_id)}
                  onSnooze={() => snooze(row.strava_activity_id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {counts.snz > 0 ? (
        <section className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Saved for later</h2>
          <ul className="space-y-2">
            {snoozed.map(({ row }) => {
              const m = activityMeta(row);
              return (
                <li
                  key={row.strava_activity_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-panel/30 px-4 py-3"
                >
                  <span className="text-sm text-white/85">
                    {m.title} · {m.date} · {m.km ? `${m.km} km` : "—"}
                  </span>
                  <Button type="button" variant="ghost" className="text-[11px]" disabled={pending} onClick={() => unsnooze(row.strava_activity_id)}>
                    Back to queue
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-6">
        <header>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">Recently confirmed</h2>
          <p className="type-meta mt-2 text-sm text-white/55">Finishes you’ve linked from this hub lately.</p>
        </header>
        {recentlyConfirmed.length === 0 ? (
          <HubEmpty
            icon="✦"
            title="No recent hub confirmations yet"
            body="After you confirm a Strava ↔ verified race match from this page, it shows here and in your profile completed races. Older finishes added outside this hub won’t be replayed in this list."
          >
            <Link href={completedRacesHref} className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90 hover:underline">
              Open completed races on profile →
            </Link>
          </HubEmpty>
        ) : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/12 bg-panel/25">
            {recentlyConfirmed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{r.displayRaceName}</p>
                  <p className="type-meta text-xs text-muted">
                    {r.date ?? "—"} ·{" "}
                    <a
                      href={`https://www.strava.com/activities/${r.stravaActivityId}`}
                      className="text-accent hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Strava
                    </a>
                  </p>
                </div>
                <Link
                  href={`/activities/${r.stravaActivityId}`}
                  className="text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
                >
                  Open story →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SyncHint({ stravaOAuthConfigured }: { stravaOAuthConfigured: boolean }) {
  if (!stravaOAuthConfigured) {
    return (
      <p className="w-full text-center text-[11px] text-white/45">
        Strava sync isn&apos;t wired on this server — use{" "}
        <Link href="/races/find" className="font-medium text-accent underline-offset-4 hover:underline">
          Find a race
        </Link>{" "}
        to add goals and finishes manually, or open the{" "}
        <Link href={buildSetupUrl("/matches")} className="font-medium text-accent underline-offset-4 hover:underline">
          setup guide
        </Link>
        .
      </p>
    );
  }
  return (
    <p className="w-full text-center text-[11px] text-white/40">
      New to imports? See the{" "}
      <Link href={buildSetupUrl("/matches")} className="font-medium text-white/60 underline-offset-4 hover:underline">
        setup checklist
      </Link>
      . After a big effort, use <strong className="font-medium text-white/55">Sync from Strava</strong> in the header.
    </p>
  );
}

function HighConfidenceCard({
  s,
  pending,
  onConfirm,
  onDismiss,
  onSnooze
}: {
  s: CanonicalStravaSuggestion;
  pending: boolean;
  onConfirm: (fd: FormData, id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}) {
  const top = s.topMatch!;
  const m = activityMeta(s);
  const stat = [m.date, m.km ? `${m.km} km` : "—", m.el != null && m.el > 0 ? `${Math.round(m.el)} m` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Card className="h-full overflow-hidden border border-gold/40 bg-gradient-to-b from-gold/[0.08] via-[#0c0e14] to-[#080a0f] p-0 shadow-lg shadow-black/40">
        <div className="border-b border-gold/20 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">Suggested match</p>
            <span className="rounded-md border border-gold/25 bg-gold/[0.08] px-2 py-0.5 text-[9px] font-semibold tabular-nums uppercase tracking-wider text-gold/90">
              {Math.round(top.score)}% · 80+ tier
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-normal leading-tight text-white md:text-[1.65rem]">{top.name}</p>
          <p className="type-meta mt-2 text-[13px] text-white/50">{m.title}</p>
          <p className="mt-1 text-[12px] font-medium uppercase tracking-wider text-white/35">{stat}</p>
        </div>
        <div className="px-6 py-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onConfirm(new FormData(e.currentTarget), s.stravaActivityId);
            }}
          >
            <input type="hidden" name="canonical_race_id" value={top.canonicalRaceId} />
            <input type="hidden" name="strava_activity_id" value={s.stravaActivityId} />
            <input type="hidden" name="date" value={s.startDateYmd} />
            <input type="hidden" name="distance_km" value={String(s.distanceKm)} />
            <input type="hidden" name="elevation_m" value={s.elevationM != null ? String(s.elevationM) : ""} />
            <Button
              type="submit"
              disabled={pending}
              className="h-auto w-full rounded-xl bg-accent py-4 text-[13px] font-bold uppercase tracking-[0.14em] shadow-md shadow-accent/25 hover:bg-[#f08a4d]"
            >
              {pending ? "Saving your finish…" : "Confirm this finish"}
            </Button>
          </form>
          <p className="mt-3 text-center text-[11px] text-white/40">One tap when your race day matches this event — we&apos;ll update your story.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/8 pt-5 text-[11px]">
            <button
              type="button"
              disabled={pending}
              className="text-white/45 underline-offset-2 transition hover:text-white hover:underline"
              onClick={() => onDismiss(s.stravaActivityId)}
            >
              Wrong race
            </button>
            <button
              type="button"
              disabled={pending}
              className="text-white/45 underline-offset-2 transition hover:text-white hover:underline"
              onClick={() => onSnooze(s.stravaActivityId)}
            >
              Not now
            </button>
            <a
              href={`https://www.strava.com/activities/${s.stravaActivityId}`}
              target="_blank"
              rel="noreferrer"
              className="text-white/45 underline-offset-2 hover:text-white hover:underline"
            >
              Open Strava
            </a>
          </div>
        </div>
      </Card>
    </li>
  );
}

function UnmatchedCard({
  row,
  pending,
  onConfirm,
  onNotRace,
  onSnooze
}: {
  row: StravaSyncedActivityRow;
  pending: boolean;
  onConfirm: (fd: FormData, id: string) => void;
  onNotRace: () => void;
  onSnooze: () => void;
}) {
  const m = activityMeta(row);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchableRaceRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = () => {
    const qq = q.trim();
    if (qq.length < 2) {
      setHits(null);
      return;
    }
    setSearching(true);
    void fetch(`/api/races/canonical/search?query=${encodeURIComponent(qq)}&limit=12`)
      .then((res) => res.json())
      .then((body: { races?: SearchableRaceRow[] }) => {
        setHits(body.races ?? []);
      })
      .catch(() => setHits([]))
      .finally(() => setSearching(false));
  };

  return (
    <Card className="border border-white/12 bg-panel/35 p-5">
      <p className="font-semibold text-white">{m.title}</p>
      <p className="type-meta mt-1 text-sm text-muted">
        {m.date} · {m.km ? `${m.km} km` : "—"}
        {m.el != null && m.el > 0 ? ` · ${Math.round(m.el)} m` : ""}
      </p>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Search verified races</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
            placeholder="Race name or place…"
            className="max-w-md border-white/15 bg-black/40"
          />
          <Button type="button" variant="secondary" disabled={pending || searching} onClick={() => runSearch()}>
            {searching ? "…" : "Search"}
          </Button>
        </div>
        {hits && hits.length === 0 ? <p className="text-xs text-white/45">No hits — try another phrase.</p> : null}
        {hits && hits.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {hits.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2">
                <span className="text-sm text-white/90">{r.name}</span>
                <form
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    onConfirm(new FormData(ev.currentTarget), row.strava_activity_id);
                  }}
                >
                  <input type="hidden" name="canonical_race_id" value={r.id} />
                  <input type="hidden" name="strava_activity_id" value={row.strava_activity_id} />
                  <input type="hidden" name="date" value={m.date} />
                  <input type="hidden" name="distance_km" value={String(m.km)} />
                  <input type="hidden" name="elevation_m" value={m.el != null ? String(m.el) : ""} />
                  <Button type="submit" disabled={pending} className="text-[10px]">
                    Link finish
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={pending} className="text-[11px] text-white/55" onClick={onNotRace}>
          Not a race
        </Button>
        <Button type="button" variant="ghost" disabled={pending} className="text-[11px]" onClick={onSnooze}>
          Save for later
        </Button>
        <Link href="/races/find" className="self-center text-[11px] font-semibold uppercase tracking-wider text-accent">
          Library →
        </Link>
      </div>
    </Card>
  );
}
