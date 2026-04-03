"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { RACE_LINKED_QUERY_KEY } from "@/lib/profile-race-linked-celebration";

function Inner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const raw = searchParams.get(RACE_LINKED_QUERY_KEY)?.trim().toLowerCase();
    if (raw !== "1" && raw !== "true") return;

    handled.current = true;
    setOpen(true);

    const focusTarget = () => {
      const el = document.getElementById("profile-completed-races");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => requestAnimationFrame(focusTarget));

    const path = window.location.pathname;
    const sp = new URLSearchParams(window.location.search);
    sp.delete(RACE_LINKED_QUERY_KEY);
    const qs = sp.toString();
    const next = `${path}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
    router.replace(next, { scroll: false });

    const t = window.setTimeout(() => setOpen(false), 5200);
    return () => window.clearTimeout(t);
  }, [searchParams, router]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-emerald-400/35 bg-[#0a1210]/95 px-4 py-3 text-center shadow-lg shadow-black/40 backdrop-blur-md"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/95">Linked</p>
      <p className="mt-1 text-sm text-white/90">Your finish is on your profile.</p>
    </div>
  );
}

/** Own-profile only: reads `?raceLinked=1`, toast + scroll to completed races, then strips the param. */
export function ProfileRaceLinkedCelebration({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
