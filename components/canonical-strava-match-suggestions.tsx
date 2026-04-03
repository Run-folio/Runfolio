"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { confirmCanonicalStravaMatchAction, dismissCanonicalStravaMatchAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import { CANONICAL_SUGGESTED_HIGH_MIN_SCORE } from "@/lib/strava-canonical-match/suggestions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  suggestions: CanonicalStravaSuggestion[];
  /** Post-confirm redirect (profile path + optional hash), e.g. `/Runner%20Name#profile-completed-races` */
  returnAfterConfirm?: string;
};

function tierLabel(topScore: number): "High match" | "Needs review" {
  return topScore >= CANONICAL_SUGGESTED_HIGH_MIN_SCORE ? "High match" : "Needs review";
}

export function CanonicalStravaMatchSuggestions({ suggestions, returnAfterConfirm = "/dashboard" }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [dismissPending, startDismiss] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [confirmErr, setConfirmErr] = useState<{ id: string; message: string } | null>(null);

  const { highTier, reviewTier } = useMemo(() => {
    const high: CanonicalStravaSuggestion[] = [];
    const review: CanonicalStravaSuggestion[] = [];
    for (const s of suggestions) {
      const sc = s.topMatch?.score ?? 0;
      if (sc >= CANONICAL_SUGGESTED_HIGH_MIN_SCORE) high.push(s);
      else review.push(s);
    }
    return { highTier: high, reviewTier: review };
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  const renderCard = (s: CanonicalStravaSuggestion) => {
    const top = s.topMatch!;
    const label = tierLabel(top.score);
    const isHigh = label === "High match";
    return (
      <li key={s.stravaActivityId}>
        <Card
          className={cn(
            "h-full border p-5",
            isHigh ? "border-gold/35 bg-gold/[0.06]" : "border-amber-500/25 bg-amber-950/[0.08]"
          )}
        >
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isHigh ? "text-gold" : "text-amber-200/90"
            )}
          >
            {label}
          </p>
          <p className="mt-2 text-base font-semibold text-white">
            We think this was <span className="text-accent">{top.name}</span>
          </p>
          <p className="type-meta mt-1 text-xs text-muted">
            {s.activityTitle} · {s.distanceKm ? `${s.distanceKm} km` : "—"}
            {s.startDateYmd ? ` · ${s.startDateYmd}` : ""}
          </p>
          <p className="type-meta mt-3 text-xs leading-relaxed text-slate-300">{top.subtitle}</p>
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
            <Link
              href={`https://www.strava.com/activities/${s.stravaActivityId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-[10px] border border-white/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted hover:border-white/30 hover:text-white"
            >
              View on Strava
            </Link>
          </div>
          {s.alternatives.length > 0 ? (
            <details className="mt-4 border-t border-white/10 pt-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted">Other verified events (same activity)</summary>
              <ul className="mt-2 space-y-2">
                {s.alternatives.map((a) => (
                  <li key={a.canonicalRaceId} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-white/90">{a.name}</span>
                    <span className="text-[10px] text-muted">{a.score} pts</span>
                  </li>
                ))}
              </ul>
              <p className="type-meta mt-2 text-[10px]">
                Prefer{" "}
                <Link href="/matches" className="text-accent underline-offset-4 hover:underline">
                  Match &amp; import
                </Link>{" "}
                to swap events with search.
              </p>
            </details>
          ) : null}
        </Card>
      </li>
    );
  };

  return (
    <section className="space-y-8">
      <div>
        <p className="type-eyebrow">You might have raced</p>
        <h2 className="type-section mt-2 text-lg md:text-xl">Smart race matches</h2>
        <p className="type-meta mt-2 max-w-2xl text-sm">
          From activities saved when you sync Strava. High matches (80+ fit score) are listed first; others need a quick
          sanity check before linking.
        </p>
        {!persistenceAvailable ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {persistenceReason ?? "Saving isn’t available — matches are view-only."}
          </p>
        ) : null}
      </div>

      {highTier.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/90">Suggested matches</h3>
          <ul className="grid gap-4 md:grid-cols-2">{highTier.map(renderCard)}</ul>
        </div>
      ) : null}

      {reviewTier.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/85">Needs review</h3>
          <p className="type-meta max-w-2xl text-xs text-white/55">
            Softer catalog fit (60–79). Confirm only if the details match your race day.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">{reviewTier.map(renderCard)}</ul>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-muted">
        <Link href="/matches" className="font-semibold uppercase tracking-[0.12em] text-accent hover:underline">
          Full Match &amp; import hub →
        </Link>
        {" · "}Bulk review, manual search, and saved-for-later
      </p>
    </section>
  );
}
