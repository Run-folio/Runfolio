import Link from "next/link";
import {
  listCanonicalRacesByStatus,
  searchCanonicalRacesForOps
} from "@/lib/races/canonical/repository";

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function RaceOpsSearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() as "duplicate_candidate" | "needs_review" | "active" | "draft" | "hidden" | undefined;

  const res = q || status
    ? await searchCanonicalRacesForOps({ query: q || undefined, status, limit: 50 })
    : await searchCanonicalRacesForOps({ limit: 30 });

  const rows = res.ok ? res.data : [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-white">Races</h1>
        <Link href="/internal/race-ops/dashboard" className="text-[12px] text-accent hover:underline">
          ← Hub
        </Link>
      </div>

      <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, slug, city…"
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white sm:w-48"
          >
            <option value="">Any</option>
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="needs_review">needs_review</option>
            <option value="duplicate_candidate">duplicate_candidate</option>
            <option value="hidden">hidden</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-white"
        >
          Search
        </button>
      </form>

      {!res.ok ? (
        <p className="mt-8 text-sm text-rose-300">{res.error}</p>
      ) : (
        <ul className="mt-8 divide-y divide-white/10 rounded-lg border border-white/10">
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-sm text-white/55">No rows.</li>
          ) : (
            rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link
                    href={`/internal/race-ops/races/${r.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {r.name}
                  </Link>
                  <p className="text-[12px] text-white/55">
                    {r.slug} · {r.status} · {r.startDate ?? "no date"}
                  </p>
                </div>
                <Link
                  href={`/races/${r.slug}`}
                  className="text-[11px] text-white/45 hover:text-white/75"
                  target="_blank"
                  rel="noreferrer"
                >
                  Public →
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </main>
  );
}
