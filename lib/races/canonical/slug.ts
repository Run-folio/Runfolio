import type { NormalizedRace } from "@/lib/races/types/normalized";

function slugifyName(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 120) || "race";
}

/** Base slug for a new canonical row (caller resolves uniqueness). */
export function baseSlugFromNormalized(n: NormalizedRace): string {
  const fromProvider = n.slug?.trim();
  if (fromProvider && /^[a-z0-9][a-z0-9-]{0,118}$/.test(fromProvider)) {
    return fromProvider;
  }
  return slugifyName(n.name || "race");
}
