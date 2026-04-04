import type { PageEnrichmentExtract } from "@/lib/races/canonical/enrichment/types";

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  if (m?.[1]) return decodeBasicEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${key}["'][^>]*>`,
    "i"
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeBasicEntities(m2[1]) : null;
}

function readTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,500})<\/title>/i);
  return m?.[1] ? decodeBasicEntities(m[1].replace(/\s+/g, " ")) : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as unknown;
      out.push(v);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

function collectFromJsonLd(node: unknown, images: string[], texts: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const x of node) collectFromJsonLd(x, images, texts);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o["@graph"] !== "undefined") {
    collectFromJsonLd(o["@graph"], images, texts);
  }
  const types = new Set<string>();
  const t = o["@type"];
  if (typeof t === "string") types.add(t);
  if (Array.isArray(t)) for (const x of t) if (typeof x === "string") types.add(x);

  const isEventish =
    types.has("SportsEvent") ||
    types.has("Event") ||
    types.has("Festival") ||
    types.has("Course");

  const img = o.image ?? o.thumbnailUrl;
  if (typeof img === "string" && img.startsWith("http")) images.push(img);
  if (Array.isArray(img)) {
    for (const x of img) {
      if (typeof x === "string" && x.startsWith("http")) images.push(x);
      if (x && typeof x === "object" && typeof (x as { url?: string }).url === "string") {
        const u = (x as { url: string }).url;
        if (u.startsWith("http")) images.push(u);
      }
    }
  }

  const desc = o.description;
  if (isEventish && typeof desc === "string" && desc.length > 20) texts.push(stripTags(desc));

  const name = o.name;
  if (isEventish && typeof name === "string" && name.length > 2) texts.push(name);

  for (const k of Object.values(o)) {
    if (k && typeof k === "object" && !Array.isArray(k) && k !== o) {
      collectFromJsonLd(k, images, texts);
    }
  }
}

function extractSnippet(html: string): string | null {
  const article = html.match(/<article[^>]*>([\s\S]{0,8000})<\/article>/i);
  const chunk = article?.[1] ?? html.slice(0, 12000);
  const text = stripTags(chunk);
  if (text.length < 40) return null;
  return text.slice(0, 480).trim();
}

function extractDistanceHints(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(?:km|K)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 5 && n <= 500) out.push(Math.round(n * 10) / 10);
  }
  const half = /\bhalf\s*marathon\b/i.test(text) ? [21.1] : [];
  const mara = /\bmarathon\b/i.test(text) && !/half/i.test(text.slice(Math.max(0, text.search(/\bmarathon\b/i) - 12), 20)) ? [42.2] : [];
  return [...new Set([...out, ...half, ...mara])].sort((a, b) => a - b);
}

function toAbsoluteUrl(pageUrl: string, href: string | null): string | null {
  if (!href?.trim()) return null;
  try {
    return new URL(href.trim(), pageUrl).href;
  } catch {
    return href.trim();
  }
}

export function extractPageEnrichment(html: string, finalUrl: string): PageEnrichmentExtract {
  const jsonBlocks = parseJsonLdBlocks(html);
  const jsonLdImages: string[] = [];
  const jsonLdSummaries: string[] = [];
  for (const block of jsonBlocks) {
    collectFromJsonLd(block, jsonLdImages, jsonLdSummaries);
  }

  const metaDescription = metaContent(html, "name", "description");
  const ogTitle = metaContent(html, "property", "og:title");
  const ogDescription = metaContent(html, "property", "og:description");
  const ogImage = metaContent(html, "property", "og:image");
  const twitterImage = metaContent(html, "name", "twitter:image") ?? metaContent(html, "property", "twitter:image");

  const pageTitle = readTitle(html);
  const snippetText = extractSnippet(html);
  const blob = [
    metaDescription,
    ogDescription,
    ogTitle,
    pageTitle,
    snippetText,
    ...jsonLdSummaries
  ]
    .filter(Boolean)
    .join(" ");

  const absLd = [...new Set(jsonLdImages)]
    .map((u) => toAbsoluteUrl(finalUrl, u))
    .filter((u): u is string => Boolean(u));

  return {
    finalUrl,
    pageTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    ogImage: toAbsoluteUrl(finalUrl, ogImage),
    twitterImage: toAbsoluteUrl(finalUrl, twitterImage),
    jsonLdSummaries: [...new Set(jsonLdSummaries)].slice(0, 8),
    jsonLdImages: absLd.slice(0, 12),
    snippetText,
    distanceHintsKm: extractDistanceHints(blob)
  };
}
