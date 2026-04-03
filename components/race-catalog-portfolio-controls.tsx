"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCatalogRaceToBucketListAction,
  clearBucketListAffiliationAction,
  deleteFutureBucketGoalAction,
  deleteUserRacePortfolioAction,
  markRaceNotCompletedPortfolioAction
} from "@/lib/actions";
import { raceIsBucketListItem } from "@/lib/bucket-list-model";
import type { Race } from "@/types";

type Props = {
  discoverRaceId: string;
  /** Logged-in viewer only; public visitors see no correction UI. */
  isOwner: boolean;
  completedRow: Race | null;
  bucketFutureRow: Race | null;
};

function SubmitButton({
  label,
  variant = "default",
  pending
}: {
  label: string;
  variant?: "default" | "danger" | "muted";
  pending: boolean;
}) {
  const base =
    "rounded-[10px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition disabled:opacity-50";
  const cls =
    variant === "danger"
      ? `${base} border border-red-500/45 text-red-200 hover:bg-red-950/40`
      : variant === "muted"
        ? `${base} border border-white/12 text-muted hover:border-white/25 hover:text-white`
        : `${base} border border-white/18 text-white hover:border-accent/40 hover:text-accent`;
  return (
    <button type="submit" disabled={pending} className={cls}>
      {pending ? "…" : label}
    </button>
  );
}

export function RaceCatalogPortfolioControls({ discoverRaceId, isOwner, completedRow, bucketFutureRow }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(
    action: (fd: FormData) => Promise<{ ok?: true; already?: true; error?: string } | { error: string }>,
    formData: FormData
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await action(formData);
      if ("error" in res && res.error) {
        setMessage(res.error);
        return;
      }
      if ("already" in res && res.already) {
        setMessage("Already on your bucket list.");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  if (!isOwner) return null;

  const addUrl = `/races/new?discover=${encodeURIComponent(discoverRaceId)}`;

  return (
    <div className="mt-6 border border-white/10 bg-black/30 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Portfolio actions</p>
      <p className="type-meta mt-2 text-xs">
        Fix mistaken matches, bucket labels, or finishes. Removing a finish clears journey and trophy completion for this
        entry; deleting removes the row entirely.
      </p>
      {message ? <p className="mt-3 text-xs text-amber-200/90">{message}</p> : null}

      <div className="mt-4 flex flex-col gap-4">
        {completedRow ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Confirmed finish</p>
            <div className="flex flex-wrap gap-2">
              {raceIsBucketListItem(completedRow) ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(clearBucketListAffiliationAction, new FormData(e.currentTarget));
                  }}
                >
                  <input type="hidden" name="race_id" value={completedRow.id} />
                  <SubmitButton label="Drop bucket-list badge" pending={pending} variant="muted" />
                </form>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(markRaceNotCompletedPortfolioAction, new FormData(e.currentTarget));
                }}
              >
                <input type="hidden" name="race_id" value={completedRow.id} />
                <SubmitButton label="Undo finish" pending={pending} variant="muted" />
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(deleteUserRacePortfolioAction, new FormData(e.currentTarget));
                }}
              >
                <input type="hidden" name="race_id" value={completedRow.id} />
                <SubmitButton label="Delete portfolio row" pending={pending} variant="danger" />
              </form>
            </div>
            <p className="text-[10px] text-muted">
              Undo finish keeps the catalog link as a future bucket row you can re-match. Delete removes the row and any
              Strava link on it.
            </p>
          </div>
        ) : null}

        {bucketFutureRow ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Bucket goal</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(deleteFutureBucketGoalAction, new FormData(e.currentTarget));
              }}
            >
              <input type="hidden" name="race_id" value={bucketFutureRow.id} />
              <SubmitButton label="Remove from bucket list" pending={pending} variant="muted" />
            </form>
          </div>
        ) : null}

        {!completedRow && !bucketFutureRow ? (
          <div className="space-y-3">
            <p className="text-[10px] text-muted">
              Log a confirmed finish from{" "}
              <Link href={addUrl} className="text-accent hover:underline">
                Add race
              </Link>{" "}
              (Strava match or manual with this catalog event).
            </p>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(addCatalogRaceToBucketListAction, new FormData(e.currentTarget));
              }}
            >
              <input type="hidden" name="discover_race_id" value={discoverRaceId} />
              <SubmitButton label="Add to bucket list" pending={pending} />
            </form>
          </div>
        ) : null}

        {completedRow ? (
          <Link href={addUrl} className="inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-white">
            + Log another year / edition →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
