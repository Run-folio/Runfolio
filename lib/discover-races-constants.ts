export type DiscoverSurface = "road" | "trail" | "mixed";

export type DiscoverGroup = "major_marathons" | "utmb" | "global_trail" | "epic_endurance";

export const DISCOVER_GROUP_LABEL: Record<DiscoverGroup, string> = {
  major_marathons: "Major marathons",
  utmb: "UTMB World Series",
  global_trail: "Global trail ultras (50k+)",
  epic_endurance: "Epic & endurance"
};

export const DISCOVER_GROUP_ORDER: DiscoverGroup[] = ["major_marathons", "utmb", "global_trail", "epic_endurance"];
