/**
 * Race card / timeline imagery.
 * Add photos under `public/photos/placeholders/` — we map known races here;
 * anything else picks deterministically from the pool so the same race always gets the same image.
 */

const PLACEHOLDER_POOL = [
  "/photos/placeholders/1.png",
  "/photos/placeholders/2.png",
  "/photos/placeholders/4.png",
  "/photos/placeholders/5.png",
  "/photos/placeholders/6.png",
  "/photos/placeholders/7.png"
] as const;

/** Named races → your placeholder files (tweak filenames as you add more). */
const PLACEHOLDER_BY_KEY: [string, string][] = [
  ["utmb", "/photos/placeholders/1.png"],
  ["boston", "/photos/placeholders/2.png"],
  ["leadville", "/photos/placeholders/4.png"],
  ["western states", "/photos/placeholders/5.png"],
  ["london", "/photos/placeholders/6.png"],
  ["hardrock", "/photos/placeholders/7.png"],
  ["chicago", "/photos/placeholders/4.png"],
  ["new york", "/photos/placeholders/5.png"],
  ["diagonale", "/photos/placeholders/6.png"],
  ["ccc", "/photos/placeholders/2.png"]
];

function placeholderForUnknown(raceName: string): string {
  let h = 0;
  for (let i = 0; i < raceName.length; i++) {
    h = (Math.imul(31, h) + raceName.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % PLACEHOLDER_POOL.length;
  return PLACEHOLDER_POOL[idx]!;
}

export function getRaceSceneImagePath(raceName: string): string {
  const n = raceName.toLowerCase().replace(/®/g, "").trim();
  for (const [key, path] of PLACEHOLDER_BY_KEY) {
    if (n.includes(key)) return path;
  }
  return placeholderForUnknown(raceName);
}
