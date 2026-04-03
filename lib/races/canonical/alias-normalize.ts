import { normalizeRaceName } from "@/lib/races/dedupe";

/** Normalize alias text for storage and lookup (lowercase, collapsed whitespace). */
export function normalizeAliasForMatch(raw: string): string {
  return normalizeRaceName(raw).replace(/\s+/g, " ").trim();
}
