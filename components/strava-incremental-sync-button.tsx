"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { buildSetupUrl } from "@/lib/setup-url";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Compact label for tight headers (e.g. Match hub). */
  compact?: boolean;
  /** Lighter control for secondary actions (e.g. Overview import row). */
  subtle?: boolean;
  /** Override idle label (still shows “Syncing…” while pending). */
  syncLabel?: string;
  className?: string;
};

/**
 * **Incremental sync only** — new Strava activities after the last successful sync.
 * Historical import lives on `/my-races` (Import from Strava).
 */
export function StravaIncrementalSyncButton({ compact, subtle, syncLabel, className }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? OVERVIEW_PATH;
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showReconnect, setShowReconnect] = useState(false);

  return (
    <div className={cn("flex flex-col items-start gap-2", subtle ? "items-center sm:items-end" : null, className)}>
      <Button
        type="button"
        variant={subtle ? "ghost" : "secondary"}
        disabled={pending || !persistenceAvailable}
        aria-busy={pending}
        title={!persistenceAvailable ? reason ?? "Saving unavailable" : undefined}
        className={
          subtle
            ? "h-9 px-3 text-[12px] font-medium normal-case tracking-normal text-white/55 hover:bg-white/[0.06] hover:text-white/80"
            : compact
              ? "text-[10px] font-semibold uppercase tracking-wider md:text-[11px]"
              : "text-[11px] font-semibold uppercase tracking-wider"
        }
        onClick={() => {
          if (pending) return;
          setMsg(null);
          setShowReconnect(false);
          start(async () => {
            const res = await syncStravaActivitiesAction();
            if ("error" in res && res.error) {
              let hint = res.error;
              if ("needBackfill" in res && res.needBackfill) {
                hint = `${res.error} Open My Races → Import from Strava first.`;
              }
              setShowReconnect("needStravaReconnect" in res && res.needStravaReconnect === true);
              setMsg(hint);
              return;
            }
            if ("ok" in res && res.ok) {
              const pfs = res.persistFailures ?? [];
              const first = pfs[0];
              const failDetail =
                first != null
                  ? ` First failure: [${first.kind}] code=${first.postgres_code ?? "—"} — ${first.message}`
                  : "";
              const errPart =
                res.errors && res.errors > 0
                  ? ` ${res.errors} row(s) failed.${failDetail || " See server logs: stravaSync.persist."}`
                  : "";
              const invalidPart =
                res.skippedInvalid && res.skippedInvalid > 0
                  ? ` ${res.skippedInvalid} skipped (invalid Strava payload — missing id or start_date).`
                  : "";
              const attemptPart =
                res.writeAttempts && res.writeAttempts > 0
                  ? ` ${res.writeAttempts} write attempt(s).`
                  : "";
              const zero =
                res.upserted === 0 &&
                res.skippedUnchanged === 0 &&
                !res.errors &&
                !res.stoppedForRateLimit &&
                !res.writeAttempts
                  ? " Nothing new since last sync."
                  : "";
              const ratePart =
                res.stoppedForRateLimit && res.rateLimitUserMessage?.trim()
                  ? ` ${res.rateLimitUserMessage}`
                  : "";
              setMsg(
                `Saved or updated ${res.upserted} activit${res.upserted === 1 ? "y" : "ies"}${res.skippedUnchanged ? ` · ${res.skippedUnchanged} unchanged` : ""}.${attemptPart}${invalidPart}${errPart}${zero}${ratePart}`
              );
            }
            router.refresh();
          });
        }}
      >
        {pending
          ? "Syncing…"
          : syncLabel?.trim()
            ? syncLabel.trim()
            : subtle
              ? "Sync new activities"
              : compact
                ? "Sync new only"
                : "Sync new activities from Strava"}
      </Button>
      {msg ? (
        <div className="max-w-md space-y-2 text-xs text-muted" role="status">
          <p>{msg}</p>
          {showReconnect ? (
            <Link
              href={`/api/strava/oauth/start?next=${encodeURIComponent(pathname)}`}
              className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
            >
              Reconnect Strava
            </Link>
          ) : null}
        </div>
      ) : null}
      {!persistenceAvailable && reason ? (
        <p className="max-w-md text-[11px] text-amber-200/90" role="status">
          {reason}{" "}
          <Link
            href={buildSetupUrl(OVERVIEW_PATH)}
            className="font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline"
          >
            Open setup
          </Link>
        </p>
      ) : null}
    </div>
  );
}
