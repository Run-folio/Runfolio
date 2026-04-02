import type { DiscoverGroup, DiscoverRace } from "@/lib/discover-races";
import { DISCOVER_GROUP_LABEL, discoverRaces } from "@/lib/discover-races";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";

export type DiscoverRaceDetail = {
  id: string;
  /** Shown in UI (may differ from short catalog name). */
  displayTitle: string;
  name: string;
  location: string;
  distanceKm: number;
  surface: DiscoverRace["surface"];
  group: DiscoverGroup;
  groupLabel: string;
  multiDay?: boolean;
  categoryLabel: string;
  shortDescription: string;
  prestige: string;
  keyStats: { label: string; value: string }[];
  heroImagePath: string;
};

const DISPLAY_TITLES: Record<string, string> = {
  "disc-ccc": "UTMB · CCC",
  "disc-occ": "UTMB · OCC",
  "disc-tds": "UTMB · TDS",
  "disc-etr": "UTMB · ETR",
  "disc-utmb": "UTMB",
  "disc-nyc": "TCS New York City Marathon"
};

const DETAILS: Record<string, Partial<Omit<DiscoverRaceDetail, "id" | "name" | "location" | "distanceKm" | "surface" | "group" | "groupLabel" | "heroImagePath">>> = {
  "disc-chicago": {
    displayTitle: "Bank of America Chicago Marathon",
    shortDescription:
      "A flat, fast major through Chicago’s neighborhoods — one of the Abbott World Marathon Majors with huge crowd energy.",
    prestige: "World Marathon Major · lottery / charity entries · iconic city-scale event",
    keyStats: [
      { label: "Typical window", value: "October (Sunday)" },
      { label: "Course character", value: "Flat road PR course" },
      { label: "Field", value: "45,000+ finishers" }
    ]
  },
  "disc-boston": {
    shortDescription:
      "The world’s oldest annual marathon — qualifying times, Heartbreak Hill, and a sacred finish on Boylston Street.",
    prestige: "BQ-only field · historic prestige · global bucket-list road race",
    keyStats: [
      { label: "Typical window", value: "Patriots’ Day (April)" },
      { label: "Course", value: "Net downhill, not record-eligible" },
      { label: "Heritage", value: "Since 1897" }
    ]
  },
  "disc-berlin": {
    shortDescription: "Where world records fall — wide roads and a straight shot through Brandenburg Gate.",
    prestige: "World Marathon Major · fastest major marathon course",
    keyStats: [
      { label: "Typical window", value: "September" },
      { label: "Surface", value: "Road" },
      { label: "Vibe", value: "Speed + history" }
    ]
  },
  "disc-london": {
    shortDescription: "A royal start, Thames bridges, and roaring crowds — a celebration lap through London.",
    prestige: "World Marathon Major · ballot & charity places",
    keyStats: [
      { label: "Typical window", value: "April" },
      { label: "Charity", value: "Huge fundraising platform" },
      { label: "Course", value: "Flat road" }
    ]
  },
  "disc-nyc": {
    shortDescription: "Five boroughs, five bridges, one finish in Central Park — the largest marathon in the world.",
    prestige: "World Marathon Major · lottery & guaranteed entry paths",
    keyStats: [
      { label: "Typical window", value: "First Sunday in November" },
      { label: "Field", value: "50,000+ starters" },
      { label: "Terrain", value: "Rolling road" }
    ]
  },
  "disc-utmb": {
    shortDescription:
      "The crown jewel of trail ultras — a full tour of Mont Blanc through three countries in a single push.",
    prestige: "UTMB World Series Finals · lottery & stones qualification",
    keyStats: [
      { label: "Typical window", value: "Late August" },
      { label: "Distance", value: "~171 km" },
      { label: "Terrain", value: "Alpine trail" }
    ]
  },
  "disc-ccc": {
    shortDescription: "Courmayeur to Chamonix — the 100 km heart of the UTMB week with serious vert and night running.",
    prestige: "UTMB World Series · high lottery demand",
    keyStats: [
      { label: "Typical window", value: "UTMB week (August)" },
      { label: "Distance", value: "~100 km" },
      { label: "Terrain", value: "Alpine trail" }
    ]
  },
  "disc-occ": {
    shortDescription: "A sharp Orsières → Chamonix trail ultra — steep, technical, and fiercely competitive.",
    prestige: "UTMB World Series",
    keyStats: [
      { label: "Typical window", value: "UTMB week" },
      { label: "Distance", value: "~55 km" },
      { label: "Terrain", value: "Mountain trail" }
    ]
  },
  "disc-tds": {
    shortDescription: "Sur les Traces des Ducs de Savoie — a brutal traverse with huge elevation between Italy and France.",
    prestige: "UTMB World Series · specialist’s race",
    keyStats: [
      { label: "Typical window", value: "UTMB week" },
      { label: "Distance", value: "~145 km" },
      { label: "Terrain", value: "Technical alpine" }
    ]
  },
  "disc-wser": {
    shortDescription: "Squaw Valley to Auburn — the Western States Endurance Run, the defining 100-mile trail race.",
    prestige: "Historic US 100-miler · lottery & qualifiers",
    keyStats: [
      { label: "Typical window", value: "Late June" },
      { label: "Distance", value: "100.2 mi" },
      { label: "Terrain", value: "Sierra Nevada trail" }
    ]
  },
  "disc-hardrock": {
    shortDescription: "A clockwise / counter-clockwise lottery in Colorado’s San Juans — altitude, exposure, and community.",
    prestige: "Iconic mountain 100 · difficult lottery",
    keyStats: [
      { label: "Typical window", value: "July (odd/even years)" },
      { label: "Distance", value: "100.5 mi" },
      { label: "Terrain", value: "High alpine" }
    ]
  },
  "disc-mds": {
    shortDescription: "Six stages through the Sahara — self-supported racing, heat, and sand as far as the eye can see.",
    prestige: "Legendary multi-stage desert ultra",
    keyStats: [
      { label: "Format", value: "Multi-day self-supported" },
      { label: "Distance", value: "~250 km staged" },
      { label: "Terrain", value: "Desert / sand" }
    ]
  }
};

function defaultCategoryLabel(surface: DiscoverRace["surface"], multiDay?: boolean): string {
  if (multiDay) return "Multi-stage endurance";
  if (surface === "road") return "Road marathon / major";
  if (surface === "trail") return "Trail ultra";
  return "Mixed / mountain";
}

function defaultPrestige(group: DiscoverGroup): string {
  if (group === "major_marathons") return "World-class road marathon — major city event";
  if (group === "utmb") return "UTMB World Series — iconic mountain trail racing";
  return "Bucket-list endurance challenge";
}

export function getCatalogDisplayTitle(discoverId: string): string {
  return DISPLAY_TITLES[discoverId] ?? discoverRaces.find((r) => r.id === discoverId)?.name ?? discoverId;
}

export function getDiscoverRaceDetail(id: string): DiscoverRaceDetail | null {
  const race = discoverRaces.find((r) => r.id === id);
  if (!race) return null;
  const extra = DETAILS[id] ?? {};
  const groupLabel = DISCOVER_GROUP_LABEL[race.group];
  const displayTitle = extra.displayTitle ?? DISPLAY_TITLES[id] ?? race.name;
  const heroImagePath = getRaceSceneImagePath(displayTitle);

  return {
    id: race.id,
    displayTitle,
    name: race.name,
    location: race.location,
    distanceKm: race.distance_km,
    surface: race.surface,
    group: race.group,
    groupLabel,
    multiDay: race.multi_day,
    categoryLabel: extra.categoryLabel ?? defaultCategoryLabel(race.surface, race.multi_day),
    shortDescription:
      extra.shortDescription ??
      `${displayTitle} — ${race.location}. A standout event in the Runfolio catalog.`,
    prestige: extra.prestige ?? defaultPrestige(race.group),
    keyStats:
      extra.keyStats ??
      [
        { label: "Distance", value: `${race.distance_km} km` },
        { label: "Surface", value: race.surface },
        { label: "Series", value: groupLabel }
      ],
    heroImagePath
  };
}

export function isDiscoverCatalogRaceId(id: string): boolean {
  return id.startsWith("disc-") && discoverRaces.some((r) => r.id === id);
}
