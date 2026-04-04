"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStravaActivitiesAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Historical import lives on My Races; setup offers that path plus incremental sync only. */
export function SetupSyncActions() {
  const router = useRouter();
  const pathname = usePathname() ?? "/setup";
  const [pendingSync, startSync] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showReconnect, setShowReconnect] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/my-races#import-strava"
          className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-accent px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f08a4d]"
        >
          Import past race efforts
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[48px] rounded-[14px] border-white/20 bg-white/5 px-8 text-[12px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-white/10"
          disabled={pendingSync}
          aria-busy={pendingSync}
          onClick={() => {
            if (pendingSync) return;
            setMsg(null);
            setShowReconnect(false);
            startSync(async () => {
              const res = await syncStravaActivitiesAction();
              if ("error" in res && res.error) {
                let text = res.error;
                let reconnect = false;
                if ("needBackfill" in res && res.needBackfill) {
                  text = `${res.error} Start with “Import past race efforts”.`;
                }
                if ("needStravaReconnect" in res && res.needStravaReconnect) {
                  reconnect = true;
                }
                setShowReconnect(reconnect);
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
        <div className="space-y-2 text-sm text-white/70" role="status">
          <p>{msg}</p>
          {showReconnect ? (
            <Link
              href={`/api/strava/oauth/start?mode=reconnect&next=${encodeURIComponent(pathname)}`}
              className="inline-flex font-semibold text-accent underline-offset-4 hover:underline"
            >
              Reconnect Strava
            </Link>
          ) : null}
        </div>
      ) : null}
      <p className="text-[13px] leading-relaxed text-white/50">
        We import likely race efforts from Strava in bounded batches and save them in Runfolio for matching and review.
        Future syncs only check for new efforts—they do not re-scan your full Strava history. After connecting Strava, open{" "}
        <strong className="font-medium text-white/70">Import past race efforts</strong> for race history, then use{" "}
        <strong className="font-medium text-white/70">My Races</strong> to confirm.
      </p>
    </div>
  );
}
