import { describe, expect, it } from "vitest";
import { extractPageEnrichment } from "@/lib/races/canonical/enrichment/extract-html-meta";
import { synthesizeRaceSummary } from "@/lib/races/canonical/enrichment/synthesize-summary";
import type { CanonicalRace } from "@/lib/races/canonical/types";

const HTML = `<!DOCTYPE html><html><head>
<title>Desert Ultra 50K</title>
<meta name="description" content="A tough trail ultra in the desert.">
<meta property="og:title" content="Desert Ultra — Official" />
<meta property="og:image" content="/images/hero.jpg" />
<meta name="twitter:image" content="https://cdn.example.com/tw.jpg" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SportsEvent","name":"Desert Ultra","description":"Join us for 50 km of sand and sky.","image":"https://cdn.example.com/ld.jpg"}
</script>
</head><body><p>Also offering 100 km option this year.</p></body></html>`;

describe("extractPageEnrichment", () => {
  it("reads title, meta, og, twitter, json-ld, and distance hints", () => {
    const ex = extractPageEnrichment(HTML, "https://race.example/event");
    expect(ex.pageTitle).toContain("Desert Ultra");
    expect(ex.metaDescription).toContain("tough trail");
    expect(ex.ogImage).toBe("https://race.example/images/hero.jpg");
    expect(ex.twitterImage).toBe("https://cdn.example.com/tw.jpg");
    expect(ex.jsonLdImages).toContain("https://cdn.example.com/ld.jpg");
    expect(ex.jsonLdSummaries.some((s) => s.includes("50 km"))).toBe(true);
    expect(ex.distanceHintsKm).toContain(100);
  });
});

describe("synthesizeRaceSummary", () => {
  it("builds a short factual sentence from structured fields", () => {
    const r = {
      name: "Alpine Trail Marathon",
      city: "Chamonix",
      region: null,
      country: "France",
      startDate: "2026-06-01",
      distanceKm: 42.2,
      elevationGainM: 2500,
      surfaceType: "trail",
      isTrail: true,
      isRoad: false,
      isUltra: false
    } as CanonicalRace;
    const s = synthesizeRaceSummary(r);
    expect(s.length).toBeGreaterThan(20);
    expect(s).toMatch(/Chamonix|France/);
    expect(s).toMatch(/42/i);
  });
});
