/** Map race names to static logo paths under /public/logos (stylized marks, not official branding). */
export function getRaceLogoPath(raceName: string): string {
  const n = raceName.toLowerCase().replace(/®/g, "").trim();
  const entries: [string, string][] = [
    ["utmb", "/logos/utmb.svg"],
    ["boston", "/logos/boston.svg"],
    ["leadville", "/logos/leadville.svg"],
    ["western states", "/logos/western-states.svg"],
    ["london", "/logos/london.svg"],
    ["hardrock", "/logos/hardrock.svg"],
    ["chicago", "/logos/chicago.svg"],
    ["new york", "/logos/new-york.svg"],
    ["diagonale", "/logos/diagonale.svg"],
    ["ccc", "/logos/default.svg"]
  ];
  for (const [key, path] of entries) {
    if (n.includes(key)) return path;
  }
  return "/logos/default.svg";
}
