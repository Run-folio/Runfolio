import type { DevMatchDebugSnapshot } from "@/lib/dev-match-debug-snapshot";

/** Fixed HUD: only renders when `NODE_ENV === "development"`. */
export function DevMatchDebugSummary({ snapshot }: { snapshot: DevMatchDebugSnapshot }) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <aside
      className="fixed bottom-3 right-3 z-[100] max-w-[18rem] rounded-lg border border-cyan-500/35 bg-[#071218]/95 px-3 py-2.5 font-mono text-[10px] leading-snug text-cyan-100/95 shadow-lg shadow-black/40 backdrop-blur-sm"
      aria-label="Development Strava and profile debug"
    >
      <p className="mb-1.5 border-b border-cyan-500/20 pb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300/95">
        Dev · data parity ({snapshot.page})
      </p>
      <ul className="space-y-0.5">
        <li>
          <span className="text-cyan-500/80">imported activities</span> {snapshot.importedActivitiesCount}
        </li>
        <li>
          <span className="text-cyan-500/80">suggested (80%+)</span> {snapshot.suggestedMatchesCount}
        </li>
        <li>
          <span className="text-cyan-500/80">confirmed finishes</span> {snapshot.confirmedMatchesCount}
        </li>
      </ul>
      <p className="mt-1.5 text-[9px] text-cyan-200/65">
        recent hub confirms: {snapshot.recentHubConfirmationsCount}
      </p>
      <p className="mt-2 border-t border-cyan-500/20 pt-1.5 text-[9px] leading-relaxed text-cyan-200/85">
        <span className="text-cyan-500/70">URL slug</span> {snapshot.profileSlugInUrl}
        <br />
        <span className="text-cyan-500/70">users.name</span>{" "}
        {snapshot.usersRow.exists ? snapshot.usersRow.name ?? "∅" : <span className="text-amber-300/90">no row</span>}
        <br />
        <span className="text-cyan-500/70">auth meta name</span> {snapshot.authMetadataName ?? "∅"}
        <br />
        <span className="text-cyan-500/70">email prefix</span> {snapshot.authEmailPrefix ?? "∅"}
        <br />
        <span className="text-cyan-500/70">resolveDefaultProfilePath</span> {snapshot.resolvedProfilePath}
        <br />
        <span className="text-cyan-500/70">slug ≡ users.name</span>{" "}
        {snapshot.slugAlignedWithUsersTable ? "yes" : "no"}
      </p>
      {snapshot.canonicalMatchDebugSamples.length > 0 ? (
        <div className="mt-2 max-h-48 overflow-y-auto border-t border-cyan-500/20 pt-1.5">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300/90">
            Dev · canonical candidates
          </p>
          <ul className="space-y-1.5 text-[9px] text-cyan-100/88">
            {snapshot.canonicalMatchDebugSamples.map((s) => (
              <li key={s.stravaActivityId} className="border-l border-cyan-500/25 pl-1.5">
                <span className="text-cyan-500/75">act</span> {s.activityTitle.slice(0, 42)}
                {s.activityTitle.length > 42 ? "…" : ""}
                <br />
                <span className="text-cyan-500/75">series hint</span>{" "}
                {(s.candidateTrace?.allSeriesIds ?? []).length
                  ? (s.candidateTrace?.allSeriesIds ?? []).slice(0, 3).join(", ")
                  : "—"}
                {s.candidateTrace?.sparseSeriesFallback ? " · sparse fallback" : ""}
                {s.candidateTrace?.nameTokenSupplement ? " · token+" : ""}
                <br />
                <span className="text-cyan-500/75">pool</span> win {s.candidateTrace?.editionCountAfterDateWindow ?? "—"}{" "}
                → series {s.candidateTrace?.editionCountAfterSeriesFilter ?? "—"}
                <br />
                {s.bestScored ? (
                  <>
                    <span className="text-cyan-500/75">best</span> {s.bestScored.name.slice(0, 36)}
                    {s.bestScored.name.length > 36 ? "…" : ""} · {Math.round(s.bestScored.score)}% ·{" "}
                    {s.bestScored.confidence}
                    <br />
                    <span className="text-cyan-500/60">seriesId</span> {s.bestScored.seriesId ?? "∅"}
                  </>
                ) : (
                  <span className="text-amber-200/80">no scored candidates after filters</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
