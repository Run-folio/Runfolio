"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { confirmCanonicalStravaMatchAction, dismissCanonicalStravaMatchAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { CANONICAL_SUGGESTED_HIGH_MIN_SCORE } from "@/lib/strava-canonical-match/match-policy";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseActivityPageId } from "@/lib/activity-route-id";
import { cn } from "@/lib/utils";

type Props = {
  suggestions: CanonicalStravaSuggestion[];
  /** Post-confirm redirect (profile path + optional hash), e.g. `/Runner%20Name#profile-completed-races` */
  returnAfterConfirm?: string;
  /** Overview: list only, no long intro/footer. */
  compact?: boolean;
};

export function CanonicalStravaMatchSuggestions({
  suggestions,
  returnAfterConfirm = "/dashboard",
  compact = false
}: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [dismissPending, startDismiss] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [confirmErr, setConfirmErr] = useState<{ id: string; message: string } | null>(null);

  const strongOnly = useMemo(() => {
    return suggestions.filter((s) => (s.topMatch?.score ?? 0) >= CANONICAL_SUGGESTED_HIGH_MIN_SCORE);
  }, [suggestions]);

  if (strongOnly.length === 0) return null;

  const renderCard = (s: CanonicalStravaSuggestion) => {
    const top = s.topMatch!;
    return (
      <li key={s.stravaActivityId}>
        <Card className={cn("h-full border p-5", "border-gold/35 bg-gold/[0.06]")}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Suggested match</p>
          <p className="mt-2 text-base font-semibold text-white">
            We think this was <span className="text-accent">{top.name}</span>
          </p>
          <p className="type-meta mt-1 text-xs text-muted">
            {Math.round(top.score)}% · {s.activityTitle} · {s.distanceKm ? `${s.distanceKm} km` : "—"}
            {s.startDateYmd ? ` · ${s.startDateYmd}` : ""}
          </p>
          {compact ? null : <p className="type-meta mt-3 text-xs leading-relaxed text-slate-300">{top.subtitle}</p>}
          {confirmErr?.id === s.stravaActivityId ? (
            <p className="mt-2 text-xs text-amber-200/90" role="alert">
              {confirmErr.message}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!persistenceAvailable) {
                  setConfirmErr({
                    id: s.stravaActivityId,
                    message: persistenceReason ?? "Saving isn’t available."
                  });
                  return;
                }
                const fd = new FormData(e.currentTarget);
                setConfirmErr(null);
                startConfirm(async () => {
                  try {
                    const res = await confirmCanonicalStravaMatchAction(fd);
                    if (res && typeof res === "object" && "error" in res && res.error) {
                      setConfirmErr({ id: s.stravaActivityId, message: String(res.error) });
                    }
                  } catch (err: unknown) {
                    if (isRedirectError(err)) throw err;
                    setConfirmErr({
                      id: s.stravaActivityId,
                      message: err instanceof Error ? err.message : "Could not save."
                    });
                  }
                });
              }}
            >
              <input type="hidden" name="canonical_race_id" value={top.canonicalRaceId} />
              <input type="hidden" name="strava_activity_id" value={s.stravaActivityId} />
              <input type="hidden" name="date" value={s.startDateYmd} />
              <input type="hidden" name="distance_km" value={String(s.distanceKm)} />
              <input type="hidden" name="elevation_m" value={s.elevationM != null ? String(s.elevationM) : ""} />
              <input type="hidden" name="return_to" value={returnAfterConfirm} />
              <Button
                type="submit"
                disabled={confirmPending || !persistenceAvailable}
                className="bg-accent text-[11px] font-semibold uppercase tracking-wider"
              >
                {confirmPending ? "Saving…" : "Yes, link this race"}
              </Button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!persistenceAvailable) return;
                const fd = new FormData(e.currentTarget);
                startDismiss(async () => {
                  await dismissCanonicalStravaMatchAction(fd);
                  router.refresh();
                });
              }}
            >
              <input type="hidden" name="strava_activity_id" value={s.stravaActivityId} />
              <Button
                type="submit"
                variant="ghost"
                disabled={dismissPending || !persistenceAvailable}
                className="text-[11px] text-muted hover:text-white"
              >
                {dismissPending ? "…" : "Not this one"}
              </Button>
            </form>
            {parseActivityPageId(s.stravaActivityId)?.kind === "file_import" ? (
              <Link
                href={`/activities/${encodeURIComponent(s.stravaActivityId)}`}
                className="inline-flex items-center rounded-[10px] border border-white/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted hover:border-white/30 hover:text-white"
              >
                View activity
              </Link>
            ) : (
              <Link
                href={`https://www.strava.com/activities/${s.stravaActivityId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-[10px] border border-white/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted hover:border-white/30 hover:text-white"
              >
                View on Strava
              </Link>
            )}
          </div>
          {s.alternatives.length > 0 ? (
            <details className="mt-4 border-t border-white/10 pt-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted">Other strong matches (same activity)</summary>
              <ul className="mt-2 space-y-2">
                {s.alternatives.map((a) => (
                  <li key={a.canonicalRaceId} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-white/90">{a.name}</span>
                    <span className="text-[10px] text-muted">{a.score}%</span>
                  </li>
                ))}
              </ul>
              <p className="type-meta mt-2 text-[10px]">
                Prefer{" "}
                <Link href="/my-races" className="text-accent underline-offset-4 hover:underline">
                  My Races
                </Link>{" "}
                to confirm or search manually.
              </p>
            </details>
          ) : null}
        </Card>
      </li>
    );
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <h2 className="sr-only">Suggested matches</h2>
        {!persistenceAvailable ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {persistenceReason ?? "Saving isn’t available — matches are view-only."}
          </p>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">{strongOnly.map(renderCard)}</ul>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="type-eyebrow">You might have raced</p>
        <h2 className="type-section mt-2 text-lg md:text-xl">Suggested matches</h2>
        <p className="type-meta mt-2 max-w-2xl text-sm">
          From activities saved when you sync Strava. We only surface catalog links at <strong className="text-white/80">80%+</strong>{" "}
          confidence — everything else belongs in manual linking on{" "}
          <Link href="/my-races" className="font-medium text-accent underline-offset-4 hover:underline">
            My Races
          </Link>
          .
        </p>
        {!persistenceAvailable ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {persistenceReason ?? "Saving isn’t available — matches are view-only."}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/90">Strong matches</h3>
        <ul className="grid gap-4 md:grid-cols-2">{strongOnly.map(renderCard)}</ul>
      </div>

      <p className="text-center text-[11px] text-muted">
        <Link href="/my-races" className="font-semibold uppercase tracking-[0.12em] text-accent hover:underline">
          Open My Races →
        </Link>
        {" · "}Manual search and saved-for-later
      </p>
    </section>
  );
}
