import { NextResponse } from "next/server";
import { getCanonicalRaceById } from "@/lib/races/canonical/repository";

export const runtime = "nodejs";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(_req: Request, ctx: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await ctx.params;
  const res = await getCanonicalRaceById(raceId.trim());
  if (!res.ok || !res.data) {
    return new NextResponse("Not found", { status: 404 });
  }
  const r = res.data;
  const title = escXml(r.name.slice(0, 72));
  const subParts = [r.city, r.country].filter((x) => x?.trim());
  const sub = escXml(subParts.join(" · ").slice(0, 80));
  const dist =
    r.distanceKm != null && Number.isFinite(r.distanceKm)
      ? escXml(`${r.distanceKm >= 100 ? Math.round(r.distanceKm) : Math.round(r.distanceKm * 10) / 10} km`)
      : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1410"/>
      <stop offset="50%" style="stop-color:#0a0c12"/>
      <stop offset="100%" style="stop-color:#0d1a28"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="none" stroke="rgba(255,165,90,0.35)" stroke-width="2"/>
  <text x="80" y="160" fill="#f4f4f5" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="52" font-weight="600">${title}</text>
  <text x="80" y="240" fill="rgba(244,244,245,0.55)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28">${sub}</text>
  ${dist ? `<text x="80" y="300" fill="rgba(255,165,90,0.9)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="32" font-weight="600">${dist}</text>` : ""}
  <text x="80" y="560" fill="rgba(244,244,245,0.35)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22">Runfolio · verified race catalog</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    }
  });
}
