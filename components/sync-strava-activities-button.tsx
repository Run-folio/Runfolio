"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SyncStravaActivitiesButton() {
  const router = useRouter();
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending || !persistenceAvailable}
        title={!persistenceAvailable ? reason ?? "Saving unavailable" : undefined}
        className="text-[11px] font-semibold uppercase tracking-wider"
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await syncStravaActivitiesAction();
            if ("error" in res && res.error) {
              setMsg(`Sync didn’t finish. ${res.error}`);
              return;
            }
            if ("ok" in res && res.ok) {
              const errPart =
                res.errors && res.errors > 0
                  ? ` ${res.errors} row(s) failed to save — check Supabase logs or RLS policies.`
                  : "";
              const zeroNote =
                res.upserted === 0 && res.skippedUnchanged === 0 && !res.errors
                  ? " No changes — try Connect Strava if you expected new data."
                  : "";
              setMsg(
                `Updated ${res.upserted} activities${res.skippedUnchanged ? ` · ${res.skippedUnchanged} already current` : ""}.${errPart}${zeroNote}`
              );
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Syncing…" : "Sync from Strava"}
      </Button>
      {msg ? (
        <p className="text-xs text-muted" role="status">
          {msg}
        </p>
      ) : null}
      {!persistenceAvailable && reason ? (
        <p className="max-w-md text-[11px] text-amber-200/90" role="status">
          {reason}{" "}
          <Link href={buildSetupUrl("/dashboard")} className="font-semibold text-accent underline-offset-4 hover:underline">
            Open setup
          </Link>
        </p>
      ) : null}
    </div>
  );
}
