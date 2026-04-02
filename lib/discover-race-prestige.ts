import { getDiscoverRaceById } from "@/lib/known-race-match";
import type { DiscoverGroup } from "@/lib/discover-races";

/**
 * Portfolio / Top Races ranking metadata for catalog events.
 * Tiers: 1 = global legend, 2 = majors & iconic ultras, 3 = strong ultras / shorter series, 4 = fallback.
 */
export type DiscoverPrestigeMeta = {
  race_tier: 1 | 2 | 3 | 4;
  /** 0–100 baseline; combined with distance/elevation/tags in `top-race-rank`. */
  prestige_base: number;
  is_major_marathon: boolean;
  is_utmb_series: boolean;
  /** UTMB finals, WSER, Hardrock, MDS, Tor, etc. */
  is_iconic_ultra: boolean;
  /** ~100 mi single-stage or equivalent iconic hundreds */
  is_hundred_miler: boolean;
  category_group: DiscoverGroup | "unmatched";
};

const WMM_IDS = new Set([
  "disc-london",
  "disc-boston",
  "disc-berlin",
  "disc-chicago",
  "disc-nyc",
  "disc-tokyo"
]);

/** Explicit prestige per catalog id — tune here without touching UI. */
const PRESTIGE_BY_ID: Record<string, DiscoverPrestigeMeta> = {
  "disc-utmb": {
    race_tier: 1,
    prestige_base: 100,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-tor": {
    race_tier: 1,
    prestige_base: 99,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-moab": {
    race_tier: 1,
    prestige_base: 98,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-mds": {
    race_tier: 1,
    prestige_base: 97,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-wser": {
    race_tier: 1,
    prestige_base: 96,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: true,
    category_group: "epic_endurance"
  },
  "disc-hardrock": {
    race_tier: 1,
    prestige_base: 95,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: true,
    category_group: "epic_endurance"
  },
  "disc-badwater": {
    race_tier: 1,
    prestige_base: 94,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-spartathlon": {
    race_tier: 1,
    prestige_base: 93,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-diagonale": {
    race_tier: 2,
    prestige_base: 92,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-tds": {
    race_tier: 2,
    prestige_base: 91,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-ccc": {
    race_tier: 2,
    prestige_base: 90,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-lavaredo": {
    race_tier: 2,
    prestige_base: 88,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-leadville": {
    race_tier: 2,
    prestige_base: 87,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: true,
    category_group: "epic_endurance"
  },
  "disc-occ": {
    race_tier: 2,
    prestige_base: 82,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-etr": {
    race_tier: 3,
    prestige_base: 76,
    is_major_marathon: false,
    is_utmb_series: true,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "utmb"
  },
  "disc-pikes": {
    race_tier: 2,
    prestige_base: 78,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: true,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-two-oceans": {
    race_tier: 2,
    prestige_base: 77,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "epic_endurance"
  },
  "disc-london": {
    race_tier: 2,
    prestige_base: 86,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-boston": {
    race_tier: 2,
    prestige_base: 86,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-berlin": {
    race_tier: 2,
    prestige_base: 85,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-chicago": {
    race_tier: 2,
    prestige_base: 85,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-nyc": {
    race_tier: 2,
    prestige_base: 85,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-tokyo": {
    race_tier: 2,
    prestige_base: 85,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-valencia": {
    race_tier: 2,
    prestige_base: 80,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  },
  "disc-paris": {
    race_tier: 2,
    prestige_base: 80,
    is_major_marathon: true,
    is_utmb_series: false,
    is_iconic_ultra: false,
    is_hundred_miler: false,
    category_group: "major_marathons"
  }
};

function defaultMetaFromDiscover(
  id: string,
  group: DiscoverGroup,
  distanceKm: number
): DiscoverPrestigeMeta {
  const isWmm = WMM_IDS.has(id);
  const hundred = distanceKm >= 161 && distanceKm <= 170;
  if (group === "major_marathons") {
    return {
      race_tier: 2,
      prestige_base: isWmm ? 84 : 79,
      is_major_marathon: true,
      is_utmb_series: false,
      is_iconic_ultra: false,
      is_hundred_miler: false,
      category_group: "major_marathons"
    };
  }
  if (group === "utmb") {
    return {
      race_tier: 3,
      prestige_base: 72,
      is_major_marathon: false,
      is_utmb_series: true,
      is_iconic_ultra: false,
      is_hundred_miler: false,
      category_group: "utmb"
    };
  }
  return {
    race_tier: 3,
    prestige_base: hundred ? 78 : 70,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: distanceKm >= 120,
    is_hundred_miler: hundred,
    category_group: "epic_endurance"
  };
}

export function getDiscoverPrestigeMeta(discoverRaceId: string | null | undefined): DiscoverPrestigeMeta | null {
  if (!discoverRaceId) return null;
  const fixed = PRESTIGE_BY_ID[discoverRaceId];
  if (fixed) return fixed;
  const d = getDiscoverRaceById(discoverRaceId);
  if (!d) return null;
  return defaultMetaFromDiscover(discoverRaceId, d.group, d.distance_km);
}

/** Tier / prestige for efforts without a catalog match (long Strava-only rows). */
export function unmatchedEffortPrestige(km: number): DiscoverPrestigeMeta {
  let tier: 3 | 4 = 4;
  let base = 28;
  if (km >= 161) {
    tier = 3;
    base = 48;
  } else if (km >= 100) {
    tier = 3;
    base = 42;
  } else if (km >= 42) {
    base = 34;
  } else if (km >= 21) {
    base = 30;
  }
  return {
    race_tier: tier,
    prestige_base: base,
    is_major_marathon: false,
    is_utmb_series: false,
    is_iconic_ultra: km >= 100,
    is_hundred_miler: km >= 161 && km <= 170,
    category_group: "unmatched"
  };
}
