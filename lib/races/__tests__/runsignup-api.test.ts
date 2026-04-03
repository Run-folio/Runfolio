import { describe, expect, it } from "vitest";
import {
  parseRunSignupRaceRecord,
  unwrapRunSignupRaceList
} from "@/lib/races/providers/runsignup-api";

describe("unwrapRunSignupRaceList", () => {
  it("handles array and single race", () => {
    const multi = {
      races: {
        race: [
          { race_id: 1, name: "A" },
          { race_id: 2, name: "B" }
        ]
      }
    };
    expect(unwrapRunSignupRaceList(multi)).toHaveLength(2);
    const single = { races: { race: { race_id: 9, name: "Solo" } } };
    expect(unwrapRunSignupRaceList(single)).toHaveLength(1);
  });
});

describe("parseRunSignupRaceRecord", () => {
  it("reads address and start date", () => {
    const row = {
      race_id: 42,
      name: "Spring Half",
      url: "https://runsignup.com/Race/42",
      next_start_date: "2026-05-01",
      address: { city: "Austin", state: "TX", country: "US" }
    };
    const p = parseRunSignupRaceRecord(row);
    expect(p.race_id).toBe("42");
    expect(p.name).toBe("Spring Half");
    expect(p.address.city).toBe("Austin");
    expect(p.event_start_time).toContain("2026-05-01");
  });
});
