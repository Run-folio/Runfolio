import { existsSync } from "node:fs";
import path from "node:path";

/** Default hero art: replace `public/photos/profile/398346038.jpg` with your photo anytime. */
const DEFAULT_HERO = "398346038.jpg" as const;
const CANDIDATES = ["hero.webp", "hero.jpg", "hero.jpeg", "hero.png"] as const;

/**
 * Prefers custom `hero.*` in `public/photos/profile/`, then `398346038.jpg`, else reference.
 */
export function resolveProfileHeroPhoto(): string {
  const dir = path.join(process.cwd(), "public", "photos", "profile");
  for (const file of CANDIDATES) {
    if (existsSync(path.join(dir, file))) {
      return `/photos/profile/${file}`;
    }
  }
  if (existsSync(path.join(dir, DEFAULT_HERO))) {
    return `/photos/profile/${DEFAULT_HERO}`;
  }
  return "/reference/hero-2.png";
}
