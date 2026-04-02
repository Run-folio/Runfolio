/**
 * Trophy-case collections: ordered discover catalog ids per set.
 * Add new slugs here + a row on `/collections` to extend.
 */
export type TrophyCollectionDefinition = {
  slug: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Ordered race slots (left → right in the hero wall). */
  discoverRaceIds: string[];
};

export const TROPHY_COLLECTIONS: Record<string, TrophyCollectionDefinition> = {
  utmb: {
    slug: "utmb",
    eyebrow: "Trophy case",
    title: "UTMB World Series",
    subtitle:
      "The crown events around Mont Blanc and the wider UTMB World Series — a wall of mountain legends.",
    discoverRaceIds: [
      "disc-utmb",
      "disc-ccc",
      "disc-occ",
      "disc-tds",
      "disc-etr",
      "disc-lavaredo"
    ]
  },
  "world-marathon-majors": {
    slug: "world-marathon-majors",
    eyebrow: "Trophy case",
    title: "World Marathon Majors",
    subtitle:
      "Six-star road majors — the most iconic city marathons on the planet. One wall, six finisher stories waiting.",
    discoverRaceIds: ["disc-tokyo", "disc-boston", "disc-london", "disc-berlin", "disc-chicago", "disc-nyc"]
  }
};

export function getTrophyCollection(slug: string): TrophyCollectionDefinition | null {
  return TROPHY_COLLECTIONS[slug] ?? null;
}

export function listTrophyCollectionSlugs(): string[] {
  return Object.keys(TROPHY_COLLECTIONS);
}
