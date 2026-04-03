/** Internal path only — blocks open redirects. */

export function parseSafeRedirectPath(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("://")) return null;
  if (s.includes("\n") || s.includes("\r")) return null;
  return s;
}
