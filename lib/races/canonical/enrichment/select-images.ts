import type { EnrichmentImagePick, ImageCandidate, PageEnrichmentExtract } from "@/lib/races/canonical/enrichment/types";
import { scoreImageCandidate } from "@/lib/races/canonical/enrichment/score-image-candidate";

function resolveUrl(pageUrl: string, href: string): string | null {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return null;
  }
}

function isLogoish(url: string): boolean {
  return /logo|brand|icon|favicon|mark/i.test(url);
}

function isHeroish(url: string): boolean {
  return /hero|banner|cover|header|og|share|social|photo|image/i.test(url) && !isLogoish(url);
}

/**
 * Prefer official OG/Twitter hero, then JSON-LD; split logo-ish URLs to logo slot.
 */
export function selectEnrichmentImages(extract: PageEnrichmentExtract): EnrichmentImagePick {
  const pageUrl = extract.finalUrl;
  const candidates: ImageCandidate[] = [];

  const push = (url: string | null | undefined, kind: ImageCandidate["kind"]) => {
    if (!url?.trim()) return;
    const abs = resolveUrl(pageUrl, url.trim());
    if (!abs || !abs.startsWith("http")) return;
    const score = scoreImageCandidate(abs, kind, pageUrl);
    candidates.push({ url: abs, kind, score });
  };

  push(extract.ogImage, "og");
  push(extract.twitterImage, "twitter");
  for (const u of extract.jsonLdImages) push(u, "jsonld");

  candidates.sort((a, b) => b.score - a.score);

  let logoUrl: string | null = null;
  let heroUrl: string | null = null;

  for (const c of candidates) {
    if (isLogoish(c.url) && !logoUrl) {
      logoUrl = c.url;
      continue;
    }
  }

  for (const c of candidates) {
    if (c.url === logoUrl) continue;
    if (isHeroish(c.url) || c.kind === "og" || c.kind === "twitter") {
      heroUrl = c.url;
      break;
    }
  }

  if (!heroUrl) {
    for (const c of candidates) {
      if (c.url !== logoUrl) {
        heroUrl = c.url;
        break;
      }
    }
  }

  if (!logoUrl) {
    for (const c of candidates) {
      if (c.url !== heroUrl && isLogoish(c.url)) {
        logoUrl = c.url;
        break;
      }
    }
  }

  const top = candidates[0];
  const imageQualityScore = top ? top.score : 0;

  return { heroUrl, logoUrl, imageQualityScore };
}
