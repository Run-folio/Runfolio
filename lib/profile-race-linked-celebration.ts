import { OVERVIEW_PATH } from "@/lib/app-paths";

/** Query flag appended to profile redirects after a successful Strava↔race confirm (client reads and strips). */
export const RACE_LINKED_QUERY_KEY = "raceLinked";

function celebrationPathname(path: string): string {
  const noHash = path.split("#")[0] ?? path;
  return (noHash.split("?")[0] ?? "").toLowerCase();
}

/** Whether to append `?raceLinked=1` for a post-confirm profile landing (skip app routes / bucket / new race). */
export function shouldAppendRaceLinkedCelebration(path: string): boolean {
  const base = celebrationPathname(path);
  if (!base || base === OVERVIEW_PATH) return false;
  if (base === "/bucket-list" || base.endsWith("/bucket-list")) return false;
  if (base.startsWith("/races/new")) return false;
  if (base.startsWith("/auth/")) return false;
  const seg = base.split("/").filter(Boolean)[0];
  const reserved = new Set([
    OVERVIEW_PATH.replace(/^\//, ""),
    "bucket-list",
    "races",
    "auth",
    "api",
    "activities",
    "collections",
    "admin"
  ]);
  if (seg && reserved.has(seg)) return false;
  return true;
}

/** Append one-shot celebration query before `#hash` (used by server actions before `redirect`). */
export function withRaceLinkedCelebration(path: string): string {
  if (!shouldAppendRaceLinkedCelebration(path)) return path;
  const hashIdx = path.indexOf("#");
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const beforeHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  if (!beforeHash.startsWith("/")) return path;
  const qIdx = beforeHash.indexOf("?");
  const pathname = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  const existing = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : "";
  const sp = new URLSearchParams(existing);
  if (sp.has(RACE_LINKED_QUERY_KEY)) return path;
  sp.set(RACE_LINKED_QUERY_KEY, "1");
  return `${pathname}?${sp.toString()}${hash}`;
}
