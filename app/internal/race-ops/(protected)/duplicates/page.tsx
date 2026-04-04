import Link from "next/link";
import { listCanonicalRacesByStatus } from "@/lib/races/canonical/repository";

export default async function RaceOpsDuplicatesPage() {
  const res = await listCanonicalRacesByStatus("duplicate_candidate", 100);
  const rows = res.ok ? res.data : [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-white">Duplicate candidates</h1>
        <Link href="/internal/race-ops/races" className="text-[12px] text-accent hover:underline">
          All races
        </Link>
      </div>
      <p className="mt-2 text-sm text-white/65">
        Rows marked <code className="rounded bg-white/10 px-1">duplicate_candidate</code>. Open an edition and use{" "}
        <strong className="text-white/85">Merge edition</strong> to fold another UUID into the keeper (sources + aliases +
        portfolio links move; loser hidden).
      </p>

      {!res.ok ? (
        <p className="mt-8 text-sm text-rose-300">{res.error}</p>
      ) : (
        <ul className="mt-8 divide-y divide-white/10 rounded-lg border border-white/10">
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-sm text-white/55">None right now.</li>
          ) : (
            rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <Link href={`/internal/race-ops/races/${r.id}`} className="font-medium text-accent hover:underline">
                  {r.name}
                </Link>
                <p className="text-[12px] text-white/55">
                  {r.id} · {r.startDate ?? "undated"}
                </p>
              </li>
            ))
          )}
        </ul>
      )}
    </main>
  );
}
