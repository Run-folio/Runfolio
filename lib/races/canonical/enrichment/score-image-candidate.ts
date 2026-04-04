import type { ImageCandidate } from "@/lib/races/canonical/enrichment/types";

function hostOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function imgHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Heuristic 0–100 score: HTTPS, same-site, dimensions in path, penalize favicon-sized icons.
 */
export function scoreImageCandidate(
  url: string,
  kind: ImageCandidate["kind"],
  pageUrl: string
): number {
  let s = 40;
  if (url.startsWith("https://")) s += 15;
  if (url.startsWith("http://")) s -= 10;

  const ph = hostOf(pageUrl);
  const ih = imgHost(url);
  if (ph && ih && (ih === ph || ih.endsWith(`.${ph}`) || ph.endsWith(`.${ih}`))) {
    s += 25;
  } else if (ph && ih) {
    s += 5;
  }

  const lower = url.toLowerCase();
  if (/(hero|banner|cover|header|og|social|share)/.test(lower)) s += 12;
  if (/(logo|brand|icon|favicon|sprite|avatar)/.test(lower)) s += kind === "inline_logo" ? 8 : -15;
  if (/\.svg(\?|$)/i.test(lower)) s -= 5;

  switch (kind) {
    case "og":
      s += 18;
      break;
    case "twitter":
      s += 14;
      break;
    case "jsonld":
      s += 10;
      break;
    case "link_icon":
      s -= 5;
      break;
    default:
      break;
  }

  return Math.max(0, Math.min(100, s));
}
