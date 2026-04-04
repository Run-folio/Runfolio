"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Compact label for tight headers (e.g. Match hub). */
  compact?: boolean;
  className?: string;
};

/**
 * **Incremental sync only** — new Strava activities after the last successful sync.
 * Historical import lives on `/import/past-races`.
 */
export function StravaIncrementalSyncButton({ compact, className }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <Button
        type="button"
        variant="secondary"
        disabled={pending || !persistenceAvailable}
        aria-busy={pending}
        title={!persistenceAvailable ? reason ?? "Saving unavailable" : undefined}
        className={
          compact
            ? "text-[10px] font-semibold uppercase tracking-wider md:text-[11px]"
            : "text-[11px] font-semibold uppercase tracking-wider"
        }
        onClick={() => {
          if (pending) return;
          setMsg(null);
          start(async () => {
            const res = await syncStravaActivitiesAction();
            if ("error" in res && res.error) {
              let hint = res.error;
              if ("needBackfill" in res && res.needBackfill) {
                hint = `${res.error} Open Import past race efforts first.`;
              }
              setMsg(hint);
              return;
            }
            if ("ok" in res && res.ok) {
              const errPart =
                res.errors && res.errors > 0
                  ? ` ${res.errors} row(s) failed to save.`
                  : "";
              const zero =
                res.upserted === 0 && res.skippedUnchanged === 0 && !res.errors && !res.stoppedForRateLimit
                  ? " Nothing new since last sync."
                  : "";
              const ratePart =
                res.stoppedForRateLimit && res.rateLimitUserMessage?.trim()
                  ? ` ${res.rateLimitUserMessage}`
                  : "";
              setMsg(
                `Saved or updated ${res.upserted} activit${res.upserted === 1 ? "y" : "ies"}${res.skippedUnchanged ? ` · ${res.skippedUnchanged} unchanged` : ""}.${errPart}${zero}${ratePart}`
              );
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Syncing…" : compact ? "Sync new only" : "Sync new activities from Strava"}
      </Button>
      {msg ? (
        <p className="max-w-md text-xs text-muted" role="status">
          {msg}
        </p>
      ) : null}
      {!persistenceAvailable && reason ? (
        <p className="max-w-md text-[11px] text-amber-200/90" role="status">
          {reason}{" "}
          <Link
            href={buildSetupUrl("/dashboard")}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Open setup
          </Link>
        </p>
      ) : null}
    </div>
  );
}
