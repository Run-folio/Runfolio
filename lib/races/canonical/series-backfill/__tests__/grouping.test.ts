import { describe, expect, it } from "vitest";
import {
  editionNameStem,
  isRiskyAliasText,
  isStemStrongEnough,
  makeGroupingKey,
  startDateYear,
  stripYearTokensFromNormalized
} from "../grouping";

describe("series backfill grouping", () => {
  it("strips calendar years from normalized titles", () => {
    expect(stripYearTokensFromNormalized("boston marathon 2025")).toBe("boston marathon");
    expect(stripYearTokensFromNormalized("event 1999")).toBe("event");
  });

  it("editionNameStem removes years after normalize", () => {
    expect(editionNameStem("Boston Marathon 2024")).toBe("boston marathon");
    expect(editionNameStem("TCS London Marathon 2023")).toBe("tcs london marathon");
  });

  it("makeGroupingKey requires geo", () => {
    expect(makeGroupingKey("Boston Marathon 2024", null, null)).toBeNull();
    const key = makeGroupingKey("Boston Marathon 2024", "Boston", "USA");
    expect(key).not.toBeNull();
    expect(key!.startsWith("boston marathon")).toBe(true);
  });

  it("startDateYear parses ISO prefix", () => {
    expect(startDateYear("2025-04-21")).toBe(2025);
    expect(startDateYear(null)).toBeNull();
  });

  it("isStemStrongEnough rejects tiny stems", () => {
    expect(isStemStrongEnough("race")).toBe(false);
    expect(isStemStrongEnough("boston marathon")).toBe(true);
    expect(isStemStrongEnough("ultralongname")).toBe(true);
  });

  it("isRiskyAliasText flags generic-only", () => {
    expect(isRiskyAliasText("marathon", "marathon")).toBe(true);
    expect(isRiskyAliasText("Boston Marathon", "boston marathon")).toBe(false);
  });
});
