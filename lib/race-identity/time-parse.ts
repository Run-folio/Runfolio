/**
 * Best-effort clock parse for portfolio `time` strings (e.g. "3:14:26", "03:14:26").
 * Returns total seconds or null when not parseable.
 */
export function parseRaceClockToSeconds(time: string | null | undefined): number | null {
  if (!time?.trim()) return null;
  const t = time.trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const [h, m, s] = t.split(":").map((x) => Number(x));
    if ([h, m, s].some((n) => !Number.isFinite(n))) return null;
    return h * 3600 + m * 60 + s;
  }
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [m, s] = t.split(":").map((x) => Number(x));
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return m * 60 + s;
  }
  return null;
}

/** Sub-3:00:00 for standard marathon window. */
export const SUB_THREE_MARATHON_SECONDS = 3 * 3600;
