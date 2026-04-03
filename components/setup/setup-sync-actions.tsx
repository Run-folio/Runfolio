"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Pull activities and refresh setup — server re-renders the handoff step. */
export function SetupSyncActions() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Button
        type="button"
        className="min-h-[48px] rounded-[14px] px-8 text-[12px] font-semibold uppercase tracking-[0.1em]"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await syncStravaActivitiesAction();
            if ("error" in res && res.error) {
              setMsg(`Couldn’t import yet. ${res.error}`);
              return;
            }
            if ("ok" in res && res.ok) {
              setMsg(
                `Imported ${res.upserted} activities${res.skippedUnchanged ? ` · ${res.skippedUnchanged} already up to date` : ""}.`
              );
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Importing…" : "Import my activities"}
      </Button>
      {msg ? (
        <p className="text-sm text-white/70" role="status">
          {msg}
        </p>
      ) : null}
      <p className="text-[13px] leading-relaxed text-white/50">
        We look for race-like runs (long efforts, &quot;Race&quot; types). Casual training stays available but
        won&apos;t crowd your match queue.
      </p>
    </div>
  );
}
