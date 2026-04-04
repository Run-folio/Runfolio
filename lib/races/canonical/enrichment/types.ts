/** Single image candidate extracted or inferred from a page. */
export type ImageCandidateKind = "og" | "twitter" | "jsonld" | "link_icon" | "inline_logo" | "other";

export type ImageCandidate = {
  url: string;
  kind: ImageCandidateKind;
  /** 0–100 */
  score: number;
  alt?: string;
};

/** Raw signals from HTML fetch (trusted official / registration URL). */
export type PageEnrichmentExtract = {
  finalUrl: string;
  pageTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterImage: string | null;
  jsonLdSummaries: string[];
  jsonLdImages: string[];
  snippetText: string | null;
  /** Distances parsed from visible text (km). */
  distanceHintsKm: number[];
};

export type EnrichmentImagePick = {
  heroUrl: string | null;
  logoUrl: string | null;
  imageQualityScore: number;
};
