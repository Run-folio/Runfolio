import Link from "next/link";
import { raceOpsLogoutAction } from "@/lib/races/internal/race-ops-actions";

export default async function RaceOpsDashboardPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-normal text-white">Race curation</h1>
          <p className="mt-2 text-sm text-white/65">
            Lightweight ops: edit canonical editions, locks, sources, enrichment queue, merges, and portfolio links.
          </p>
        </div>
        <form action={raceOpsLogoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/5"
          >
            Sign out
          </button>
        </form>
      </div>

      <ul className="mt-10 space-y-3 text-sm">
        <li>
          <Link
            href="/internal/race-ops/races"
            className="block rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-medium text-teal hover:bg-white/[0.07] hover:text-teal-hover"
          >
            Search &amp; edit races →
          </Link>
        </li>
        <li>
          <Link
            href="/internal/race-ops/duplicates"
            className="block rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-medium text-teal hover:bg-white/[0.07] hover:text-teal-hover"
          >
            Duplicate candidates →
          </Link>
        </li>
      </ul>

      <section className="mt-12 rounded-lg border border-white/10 bg-black/30 p-5 text-[13px] leading-relaxed text-white/70">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Model</h2>
        <p className="mt-2">
          <strong className="text-white/85">Displayed values</strong> live on <code className="text-white/80">canonical_races</code>.
          Imports and enrichment merge in via{" "}
          <code className="text-white/80">mergeCanonicalFromNormalized</code> / enrichment unless{" "}
          <code className="text-white/80">curation_locked[field]=true</code> — then the row keeps your manual value.
        </p>
        <p className="mt-2">
          <strong className="text-white/85">Source history</strong> remains in <code className="text-white/80">canonical_race_sources</code>{" "}
          (raw + mapped fields). <code className="text-white/80">curation_meta</code> tracks verified / weak fields and ops notes.
        </p>
      </section>
    </main>
  );
}
