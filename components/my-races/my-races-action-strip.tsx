"use client";

import Link from "next/link";
import { StravaIncrementalSyncButton } from "@/components/strava-incremental-sync-button";

type Props = {
  stravaOAuthConfigured: boolean;
};

export function MyRacesActionStrip({ stravaOAuthConfigured }: Props) {
  if (!stravaOAuthConfigured) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <Link
        href="#import-strava"
        className="inline-flex min-h-[48px] w-full flex-1 items-center justify-center rounded-xl bg-accent px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-gold-hover sm:min-w-0"
      >
        Import from Strava
      </Link>
      <StravaIncrementalSyncButton
        syncLabel="Sync new activities"
        className="w-full flex-1 sm:min-w-0 [&_button]:min-h-[48px] [&_button]:w-full [&_button]:text-[12px] [&_button]:font-semibold [&_button]:uppercase [&_button]:tracking-[0.1em]"
      />
    </div>
  );
}
