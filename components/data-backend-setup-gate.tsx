import Link from "next/link";
import { AppNavbar } from "@/components/app-navbar";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { buildSetupUrl } from "@/lib/setup-url";

type Props = {
  title: string;
  /** Short label for the feature (e.g. "My Races"). */
  featureLabel: string;
  /** Where the user wanted to go — used for guided setup `next` param */
  returnTo?: string;
};

export function DataBackendSetupGate({ title, featureLabel, returnTo = "/dashboard" }: Props) {
  const offlineDemo =
    process.env.RUNFOLIO_OFFLINE_DEMO?.trim().toLowerCase() === "1" ||
    process.env.RUNFOLIO_OFFLINE_DEMO?.trim().toLowerCase() === "true";

  return (
    <>
      <AppNavbar />
      <main className="min-h-screen bg-[#05070c] pb-24">
        <div className="app-shell mx-auto max-w-xl px-5 py-14 md:py-20">
          <p className="type-eyebrow text-amber-200/90">Setup required</p>
          <h1 className="font-display mt-3 text-3xl font-normal tracking-tight text-white md:text-4xl">{title}</h1>
          <p className="type-meta mt-6 text-base leading-relaxed text-white/70">
            {featureLabel} needs a connected Supabase project so bucket goals, race matches, and Strava sync can persist.
          </p>

          {offlineDemo ? (
            <div className="mt-8 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
              <strong className="font-semibold">RUNFOLIO_OFFLINE_DEMO</strong> is enabled. Turn it off in{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">.env.local</code> to use a live database.
            </div>
          ) : null}

          <div className="mt-8 space-y-4 rounded-xl border border-white/12 bg-[#0a0e14] p-5 text-sm leading-relaxed text-white/75">
            <p className="font-semibold text-white">Do this next</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Create a Supabase project and note the project URL and anon (or publishable) key.</li>
              <li>
                Add <code className="whitespace-nowrap rounded bg-black/40 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                and{" "}
                <code className="whitespace-nowrap rounded bg-black/40 px-1.5 py-0.5 text-xs">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>{" "}
                (or <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>)
                to <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">.env.local</code>.
              </li>
              <li>Run the SQL migrations under <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">/supabase</code> in the Supabase SQL editor (order as in your README).</li>
              <li>Restart <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">next dev</code>, then sign in again.</li>
            </ol>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-white/45">{BACKEND_NOT_CONNECTED_USER_MESSAGE}</p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={buildSetupUrl(returnTo)}
              className="inline-flex items-center justify-center rounded-[12px] bg-accent px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-gold-hover"
            >
              Guided setup
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-[12px] border border-white/18 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/35 hover:text-white"
            >
              Overview
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-[12px] border border-white/18 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-white/35 hover:text-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
