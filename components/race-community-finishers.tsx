import Link from "next/link";
import type { PublicRaceFinisher } from "@/lib/supabase/public-race-finishers";

function profilePathForRunnerName(name: string): string {
  return `/${encodeURIComponent(name.trim())}`;
}

export function RaceCommunityFinishersSection({
  heading,
  subline,
  finishers,
  /** When set, this user_id is omitted from the list (e.g. signed-in viewer). */
  excludeUserId
}: {
  heading: string;
  subline?: string;
  finishers: PublicRaceFinisher[];
  excludeUserId?: string | null;
}) {
  const rows = excludeUserId ? finishers.filter((f) => f.user_id !== excludeUserId) : finishers;
  if (rows.length === 0) return null;

  return (
    <section className="rounded-[20px] border border-white/10 bg-gradient-to-b from-[#0a0e14] to-[#05070c] px-5 py-8 md:px-8 md:py-10">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">{heading}</h2>
      {subline ? <p className="type-meta mt-2 max-w-2xl text-sm text-white/55">{subline}</p> : null}
      <ul className="mt-6 flex flex-wrap gap-2">
        {rows.map((f) => (
          <li key={`${f.user_id}-${f.race_id}`}>
            <Link
              href={profilePathForRunnerName(f.runner_name)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/90 transition hover:border-accent/40 hover:text-white"
            >
              <span className="max-w-[200px] truncate">{f.runner_name}</span>
              {f.finish_date ? (
                <span className="text-[10px] font-normal uppercase tracking-wider text-white/40">{f.finish_date}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] text-white/38">
        Only public profiles with a published finish for this course. No feed — just race-linked discovery.
      </p>
    </section>
  );
}
