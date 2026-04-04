import { describe, expect, it } from "vitest";
import { parseGpxBuffer } from "@/lib/activity-file-import/parse-gpx";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><name>Test Marathon</name>
    <trkseg>
      <trkpt lat="45.0" lon="-73.0"><ele>10</ele><time>2020-01-15T10:00:00Z</time></trkpt>
      <trkpt lat="45.01" lon="-73.01"><ele>25</ele><time>2020-01-15T12:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpxBuffer", () => {
  it("extracts name, distance, times, elevation", () => {
    const r = parseGpxBuffer(Buffer.from(SAMPLE_GPX, "utf8"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.normalized.name).toBe("Test Marathon");
    expect(r.normalized.distanceM).toBeGreaterThan(1000);
    expect(r.normalized.movingTimeSec).toBe(7200);
    expect(r.normalized.elevationGainM).toBe(15);
    expect(r.normalized.polyline).toBeTruthy();
  });
});
