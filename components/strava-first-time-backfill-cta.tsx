import Link from "next/link";
import { Card } from "@/components/ui/card";

/** First-time onboarding: no Strava rows yet + ingest ready + backfill phase ready. */
export function StravaFirstTimeBackfillCta() {
  return (
    <section aria-labelledby="first-time-backfill-heading">
      <Card className="border-accent/35 bg-gradient-to-br from-accent/10 via-panel/80 to-panel/40 p-6 md:p-8">
        <p className="type-eyebrow text-accent">Strava</p>
        <h2 id="first-time-backfill-heading" className="mt-2 font-display text-2xl font-normal tracking-tight text-white md:text-3xl">
          Backfill from Strava
        </h2>
        <p className="type-meta mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
          Import likely <strong className="font-medium text-white/90">past race efforts</strong> from your Strava history
          in safe batches. We save them in Runfolio for matching and review—no repeated Strava reads for what&apos;s
          already stored. Backfill is <strong className="font-medium text-white/90">selective by design</strong>; shorter
          or subtle efforts may need{" "}
          <Link href="/races/find" className="font-semibold text-accent underline-offset-4 hover:underline">
            Find a race
          </Link>{" "}
          or{" "}
          <Link href="/races/new" className="font-semibold text-accent underline-offset-4 hover:underline">
            Add race
          </Link>
          . <strong className="font-medium text-white/90">Future syncs</strong> only check for{" "}
          <strong className="font-medium text-white/90">new</strong> activities after your last successful sync (no full
          history re-fetch).
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/my-races#import-strava"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-accent px-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#f08a4d]"
          >
            Start backfill
          </Link>
          <Link
            href="/my-races"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-border bg-panelAlt px-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
          >
            My Races
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-muted">
          Progress is based on saved batches and activity counts—we don&apos;t estimate “percent of Strava history”
          because Strava doesn&apos;t expose a reliable total.
        </p>
      </Card>
    </section>
  );
}
