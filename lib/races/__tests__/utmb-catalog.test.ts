import { describe, expect, it } from "vitest";
import type { DiscoverRace } from "@/lib/discover-race-schema";
import { discoverRaceToNormalized } from "@/lib/races/providers/utmb-catalog";
import { buildInternalRaceId } from "@/lib/races/id";

describe("discoverRaceToNormalized", () => {
  it("maps catalog row to normalized shape", () => {
    const row: DiscoverRace = {
      id: "disc-test",
      name: "Test Trail 50K",
      location: "Boulder, USA",
      distance_km: 50,
      surface: "trail",
      group: "global_trail",
      tags: ["technical"],
      elevation_m_est: 2000
    };
    const n = discoverRaceToNormalized(row);
    expect(n.id).toBe(buildInternalRaceId("utmb_catalog", "disc-test"));
    expect(n.source).toBe("utmb_catalog");
    expect(n.distanceKm).toBe(50);
    expect(n.isUltra).toBe(true);
    expect(n.city).toBe("Boulder");
    expect(n.country).toBe("USA");
    expect(n.rawPayload).toBeTruthy();
  });
});
