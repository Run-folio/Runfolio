export type DiscoverSurface = "road" | "trail" | "mixed";

export type DiscoverGroup = "major_marathons" | "utmb" | "epic_endurance";

export type DiscoverRace = {
  id: string;
  name: string;
  location: string;
  /** Typical race distance in km (single stage unless multi_day). */
  distance_km: number;
  surface: DiscoverSurface;
  group: DiscoverGroup;
  /** Stage / multi-day events (MDS, etc.) — counts toward “100 mi+ / multi” filter. */
  multi_day?: boolean;
};

export const DISCOVER_GROUP_LABEL: Record<DiscoverGroup, string> = {
  major_marathons: "Major marathons",
  utmb: "UTMB World Series",
  epic_endurance: "Epic & endurance"
};

export const DISCOVER_GROUP_ORDER: DiscoverGroup[] = ["major_marathons", "utmb", "epic_endurance"];

export const discoverRaces: DiscoverRace[] = [
  // Major marathons (road)
  {
    id: "disc-london",
    name: "London Marathon",
    location: "London, UK",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-boston",
    name: "Boston Marathon",
    location: "Boston, USA",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-berlin",
    name: "Berlin Marathon",
    location: "Berlin, Germany",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-chicago",
    name: "Chicago Marathon",
    location: "Chicago, USA",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-nyc",
    name: "New York City Marathon",
    location: "New York, USA",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-tokyo",
    name: "Tokyo Marathon",
    location: "Tokyo, Japan",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-valencia",
    name: "Valencia Marathon",
    location: "Valencia, Spain",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  {
    id: "disc-paris",
    name: "Paris Marathon",
    location: "Paris, France",
    distance_km: 42.2,
    surface: "road",
    group: "major_marathons"
  },
  // UTMB World Series
  {
    id: "disc-utmb",
    name: "UTMB",
    location: "Chamonix, France",
    distance_km: 171,
    surface: "trail",
    group: "utmb"
  },
  {
    id: "disc-ccc",
    name: "CCC",
    location: "Courmayeur → Chamonix",
    distance_km: 101,
    surface: "trail",
    group: "utmb"
  },
  {
    id: "disc-occ",
    name: "OCC",
    location: "Orsières → Chamonix",
    distance_km: 55,
    surface: "trail",
    group: "utmb"
  },
  {
    id: "disc-tds",
    name: "TDS",
    location: "Courmayeur → Chamonix",
    distance_km: 145,
    surface: "trail",
    group: "utmb"
  },
  {
    id: "disc-etr",
    name: "ETR",
    location: "Orsières → Martigny",
    distance_km: 55,
    surface: "trail",
    group: "utmb"
  },
  {
    id: "disc-lavaredo",
    name: "Ultra Trail Cortina",
    location: "Cortina, Italy",
    distance_km: 120,
    surface: "trail",
    group: "utmb"
  },
  // Epic & endurance
  {
    id: "disc-mds",
    name: "Marathon des Sables",
    location: "Sahara, Morocco",
    distance_km: 250,
    surface: "trail",
    group: "epic_endurance",
    multi_day: true
  },
  {
    id: "disc-wser",
    name: "Western States 100",
    location: "California, USA",
    distance_km: 161,
    surface: "trail",
    group: "epic_endurance"
  },
  {
    id: "disc-hardrock",
    name: "Hardrock 100",
    location: "Colorado, USA",
    distance_km: 161,
    surface: "trail",
    group: "epic_endurance"
  },
  {
    id: "disc-leadville",
    name: "Leadville Trail 100",
    location: "Colorado, USA",
    distance_km: 161,
    surface: "trail",
    group: "epic_endurance"
  },
  {
    id: "disc-badwater",
    name: "Badwater 135",
    location: "Death Valley → Mt Whitney, USA",
    distance_km: 217,
    surface: "road",
    group: "epic_endurance"
  },
  {
    id: "disc-spartathlon",
    name: "Spartathlon",
    location: "Athens → Sparta, Greece",
    distance_km: 246,
    surface: "road",
    group: "epic_endurance",
    multi_day: true
  },
  {
    id: "disc-tor",
    name: "Tor des Géants",
    location: "Aosta Valley, Italy",
    distance_km: 330,
    surface: "trail",
    group: "epic_endurance",
    multi_day: true
  },
  {
    id: "disc-moab",
    name: "Moab 240",
    location: "Moab, USA",
    distance_km: 386,
    surface: "trail",
    group: "epic_endurance",
    multi_day: true
  },
  {
    id: "disc-diagonale",
    name: "La Diagonale des Fous",
    location: "Réunion Island",
    distance_km: 165,
    surface: "trail",
    group: "epic_endurance"
  },
  {
    id: "disc-pikes",
    name: "Pikes Peak Marathon",
    location: "Colorado, USA",
    distance_km: 42.2,
    surface: "mixed",
    group: "epic_endurance"
  },
  {
    id: "disc-two-oceans",
    name: "Two Oceans Marathon",
    location: "Cape Town, South Africa",
    distance_km: 56,
    surface: "road",
    group: "epic_endurance"
  }
];

export type DistanceFilterId = "any" | "half" | "marathon" | "ultra" | "hundred_plus";

export type SurfaceFilterId = "any" | DiscoverSurface;

export function formatDiscoverDistance(km: number, multiDay?: boolean): string {
  if (multiDay) return `${km} km (multi-stage)`;
  if (km >= 161 && km <= 165) return "100 mi";
  if (Math.abs(km - 42.2) < 2) return "Marathon";
  if (km < 30) return `${km} km`;
  return `${km} km`;
}

export function matchesDiscoverFilters(
  race: DiscoverRace,
  query: string,
  distance: DistanceFilterId,
  surface: SurfaceFilterId
): boolean {
  const q = query.trim().toLowerCase();
  if (q) {
    const blob = `${race.name} ${race.location}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }

  if (surface !== "any" && race.surface !== surface) return false;

  if (distance === "any") return true;
  const d = race.distance_km;
  const multi = race.multi_day === true;

  switch (distance) {
    case "half":
      return d <= 25 && !multi;
    case "marathon":
      return d > 25 && d <= 50 && !multi;
    case "ultra":
      return !multi && d > 50 && d < 161;
    case "hundred_plus":
      return d >= 161 || multi;
    default:
      return true;
  }
}
