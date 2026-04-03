"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Historical import lives on `/import/past-races`; setup offers that path plus incremental sync only. */
export function SetupSyncActions() {
  const router = useRouter();
  const [pendingSync, startSync] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/import/past-races"
          className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-accent px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f08a4d]"
        >
          Import past race efforts
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[48px] rounded-[14px] border-white/20 bg-white/5 px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-white/10"
          disabled={pendingSync}
          onClick={() => {
            setMsg(null);
            startSync(async () => {
              const res = await syncStravaActivitiesAction();
              if ("error" in res && res.error) {
                let text = res.error;
                if ("needBackfill" in res && res.needBackfill) {
                  text = `${res.error} Start with “Import past race efforts”.`;
                }
                setMsg(text);
                return;
              }
              if ("ok" in res && res.ok) {
                const rate =
                  res.stoppedForRateLimit && res.rateLimitUserMessage?.trim()
                    ? ` ${res.rateLimitUserMessage}`
                    : "";
                setMsg(
                  `Synced ${res.upserted} new activities${res.skippedUnchanged ? ` · ${res.skippedUnchanged} already up to date` : ""}.${rate}`
                );
              }
              router.refresh();
            });
          }}
        >
          {pendingSync ? "Syncing…" : "Sync new activities only"}
        </Button>
      </div>
      {msg ? (
        <p className="text-sm text-white/70" role="status">
          {msg}
        </p>
      ) : null}
      <p className="text-[13px] leading-relaxed text-white/50">
        We import likely race efforts from Strava in bounded batches and save them in Runfolio for matching and review.
        Future syncs only check for new efforts—they do not re-scan your full Strava history. After connecting Strava, open{" "}
        <strong className="font-medium text-white/70">Import past race efforts</strong> for race history, then use{" "}
        <strong className="font-medium text-white/70">Match &amp; import</strong> to confirm.
      </p>
    </div>
  );
}
