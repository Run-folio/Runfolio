import { runfolioLog } from "@/lib/runfolio-log";

const DEFAULT_UA =
  "RunfolioCanonicalBot/1.0 (+https://runfolio.app; race catalog enrichment; contact: support@runfolio.app)";

export type FetchedPage = {
  ok: true;
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  html: string;
};

export type FetchPageError = { ok: false; message: string };

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 6;

function sameSiteHost(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
}

/**
 * Fetch HTML for enrichment. Follows redirects on same registrable intent only (stays on initial host or www variant).
 */
export async function fetchRacePageHtml(
  startUrl: string,
  options?: { timeoutMs?: number; userAgent?: string }
): Promise<FetchedPage | FetchPageError> {
  const timeoutMs = options?.timeoutMs ?? 18_000;
  const ua = options?.userAgent ?? DEFAULT_UA;
  let url = startUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, message: "URL must be http(s)." };
  }

  let initial: URL;
  try {
    initial = new URL(url);
  } catch {
    return { ok: false, message: "Invalid URL." };
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    let current = initial.href;
    let finalUrl = current;

    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: {
          "user-agent": ua,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9"
        }
      });

      finalUrl = res.url || current;

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, message: `Redirect ${res.status} without Location.` };
        const next = new URL(loc, finalUrl);
        if (!sameSiteHost(initial, next)) {
          return { ok: false, message: "Cross-domain redirect blocked for enrichment." };
        }
        current = next.href;
        continue;
      }

      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}` };
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.toLowerCase().includes("text/html") && !ct.toLowerCase().includes("application/xhtml")) {
        return { ok: false, message: `Not HTML (${ct || "unknown type"})` };
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return { ok: false, message: "Page too large." };
      }
      const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return {
        ok: true,
        url: startUrl,
        finalUrl,
        status: res.status,
        contentType: ct,
        html
      };
    }

    return { ok: false, message: "Too many redirects." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runfolioLog.warn("enrichment.fetch", msg, { url: startUrl.slice(0, 80) });
    return { ok: false, message: msg.includes("abort") ? "Fetch timeout." : msg };
  } finally {
    clearTimeout(t);
  }
}
