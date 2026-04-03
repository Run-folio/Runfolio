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
          <span className="text-cyan-500/80">needs review</span> {snapshot.needsReviewCount}
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
    </aside>
  );
}
