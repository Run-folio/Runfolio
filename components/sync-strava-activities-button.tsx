"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function SyncStravaActivitiesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        className="text-[11px] font-semibold uppercase tracking-wider"
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await syncStravaActivitiesAction();
            if ("error" in res && res.error) {
              setMsg(res.error);
              return;
            }
            if ("ok" in res && res.ok) {
              setMsg(
                `Updated ${res.upserted} activities${res.skippedUnchanged ? ` · ${res.skippedUnchanged} already current` : ""}.`
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
    </div>
  );
}
