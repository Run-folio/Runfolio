import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { raceOpsEnabled } from "@/lib/races/internal/race-ops-auth";

export const metadata: Metadata = {
  title: "Race ops · Runfolio",
  robots: { index: false, follow: false }
};

export default function RaceOpsRootLayout({ children }: { children: React.ReactNode }) {
  if (!raceOpsEnabled()) notFound();
  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-100/95">
        Internal race curation — not indexed · protect RACE_OPS_SECRET
      </div>
      {children}
    </div>
  );
}
