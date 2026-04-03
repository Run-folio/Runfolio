"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmCanonicalStravaMatchAction, dismissCanonicalStravaMatchAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import type { CanonicalStravaSuggestion } from "@/lib/strava-canonical-match/suggestions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = {
  suggestions: CanonicalStravaSuggestion[];
  /** Post-confirm redirect (profile path + optional hash), e.g. `/Runner%20Name#profile-completed-races` */
  returnAfterConfirm?: string;
};

function confidenceLabel(c: string) {
  if (c === "high") return "Likely match";
  if (c === "medium") return "Possible match";
  return "Low confidence";
}

export function CanonicalStravaMatchSuggestions({ suggestions, returnAfterConfirm = "/dashboard" }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason: persistenceReason } = usePersistence();
  const [dismissPending, startDismiss] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [confirmErr, setConfirmErr] = useState<{ id: string; message: string } | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <p className="type-eyebrow">You might have raced</p>
        <h2 className="type-section mt-2 text-lg md:text-xl">Smart race matches</h2>
        <p className="type-meta mt-2 max-w-2xl text-sm">
          We lined up your Strava efforts with verified events. One tap adds the finish to your story.
        </p>
        {!persistenceAvailable ? (
          <p className="mt-3 max-w-2xl rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {persistenceReason ?? "Saving isn’t available — matches are view-only."}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {suggestions.map((s) => {
          const top = s.topMatch!;
          return (
            <li key={s.stravaActivityId}>
              <Card
                className={cn(
                  "h-full border p-5",
                  top.confidence === "high" ? "border-gold/35 bg-gold/[0.06]" : "border-white/12 bg-panel/50"
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                  {confidenceLabel(top.confidence)}
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  We think this was{" "}
                  <span className="text-accent">{top.name}</span>
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
                    <summary className="cursor-pointer font-medium text-muted">Other possibilities</summary>
                    <ul className="mt-2 space-y-2">
                      {s.alternatives.map((a) => (
                        <li key={a.canonicalRaceId} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-white/90">{a.name}</span>
                          <span className="text-[10px] text-muted">{a.score} pts</span>
                        </li>
                      ))}
                    </ul>
                    <p className="type-meta mt-2 text-[10px]">
                      Pick the best hint above, or add the race from your{" "}
                      <Link href="/bucket-list" className="text-accent underline-offset-4 hover:underline">
                        bucket list
                      </Link>{" "}
                      first.
                    </p>
                  </details>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-[11px] text-muted">
        <Link href="/matches" className="font-semibold uppercase tracking-[0.12em] text-accent hover:underline">
          Full Match &amp; import hub →
        </Link>
        {" · "}Bulk review, manual search, and saved-for-later
      </p>
    </section>
  );
}
