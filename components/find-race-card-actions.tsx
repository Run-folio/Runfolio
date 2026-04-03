"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCatalogRaceToBucketListAction } from "@/lib/actions";
import { usePersistence } from "@/components/persistence-context";
import type { CatalogDiscoverViewerState } from "@/lib/catalog-discover-user-state";
import { cn } from "@/lib/utils";

type Props = {
  discoverId: string;
  state: CatalogDiscoverViewerState;
};

export function FindRaceCardActions({ discoverId, state }: Props) {
  const router = useRouter();
  const { persistenceAvailable, reason } = usePersistence();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (state.kind === "guest") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/races/find`)}`}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent hover:underline"
        >
          Sign in to track
        </Link>
        <span className="text-muted">·</span>
        <Link
          href={`/races/${discoverId}`}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-white"
        >
          Details
        </Link>
      </div>
    );
  }

  const addToBucket = () => {
    if (!persistenceAvailable) {
      setMsg(reason ?? "Saving isn’t available.");
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set("discover_race_id", discoverId);
    startTransition(async () => {
      const res = await addCatalogRaceToBucketListAction(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      if ("already" in res && res.already) {
        setMsg("Already on your bucket list.");
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {state.status === "none" ? (
          <button
            type="button"
            disabled={pending || !persistenceAvailable}
            title={!persistenceAvailable ? reason ?? undefined : undefined}
            onClick={addToBucket}
            className={cn(
              "rounded-[10px] border border-accent/50 bg-accent/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent/25 disabled:opacity-50"
            )}
          >
            {pending ? "…" : "Add to bucket list"}
          </button>
        ) : null}
        {state.status === "bucket" ? (
          <span className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/90">
            On your bucket list
          </span>
        ) : null}
        {state.status === "completed" ? (
          <span className="rounded-[10px] border border-green-500/40 bg-green-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-200/90">
            In your portfolio
          </span>
        ) : null}
        <Link
          href={`/races/${discoverId}`}
          className="rounded-[10px] border border-white/12 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition hover:border-white/25 hover:text-white"
        >
          Details
        </Link>
      </div>
      {msg ? <p className="text-[11px] text-amber-200/90">{msg}</p> : null}
    </div>
  );
}
