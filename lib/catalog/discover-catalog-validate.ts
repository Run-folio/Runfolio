import type { CatalogRaceRecord } from "@/lib/catalog/types";

export type DiscoverCatalogIssue = {
  level: "error" | "warning";
  recordId: string;
  code: string;
  message: string;
};

const GENERIC_ALIAS_TOKENS = new Set([
  "marathon",
  "half",
  "ultra",
  "trail",
  "road",
  "race",
  "run",
  "running",
  "km",
  "k",
  "mi",
  "miler",
  "10k",
  "5k",
  "21k",
  "42k",
  "50k",
  "100k",
  "the"
]);

function normAlias(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRiskyGenericAlias(alias: string): boolean {
  const n = normAlias(alias);
  if (n.length < 4) return true;
  const tokens = n.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_ALIAS_TOKENS.has(t));
}

/** Light QA on merged catalog records — run in tests or CI. */
export function validateDiscoverCatalogRecords(records: CatalogRaceRecord[]): DiscoverCatalogIssue[] {
  const issues: DiscoverCatalogIssue[] = [];
  const seenIds = new Set<string>();

  for (const r of records) {
    if (seenIds.has(r.id)) {
      issues.push({ level: "error", recordId: r.id, code: "dup_id", message: "Duplicate catalog id" });
    }
    seenIds.add(r.id);

    if (r.edition_date_quality === "anchor" && !r.edition_date_anchor_ymd?.trim()) {
      issues.push({
        level: "error",
        recordId: r.id,
        code: "anchor_without_date",
        message: "edition_date_quality is anchor but edition_date_anchor_ymd is missing"
      });
    }

    if (r.edition_date_anchor_ymd?.trim() && r.edition_date_quality && r.edition_date_quality !== "anchor") {
      issues.push({
        level: "warning",
        recordId: r.id,
        code: "anchor_date_quality_mismatch",
        message: `Has edition_date_anchor_ymd but edition_date_quality is ${r.edition_date_quality}`
      });
    }

    if (r.match_tier === "flagship") {
      if (!r.country?.trim()) {
        issues.push({
          level: "warning",
          recordId: r.id,
          code: "flagship_missing_country",
          message: "Flagship tier should include structured country"
        });
      }
      if (!r.city?.trim()) {
        issues.push({
          level: "warning",
          recordId: r.id,
          code: "flagship_missing_city",
          message: "Flagship tier should include structured city"
        });
      }
    }

    const aliasNorms: string[] = [];
    for (const a of r.aliases ?? []) {
      const na = normAlias(a);
      if (!na) continue;
      if (aliasNorms.includes(na)) {
        issues.push({
          level: "warning",
          recordId: r.id,
          code: "dup_alias",
          message: `Duplicate alias (normalized): "${a}"`
        });
      } else {
        aliasNorms.push(na);
      }
      if (isRiskyGenericAlias(a)) {
        issues.push({
          level: "warning",
          recordId: r.id,
          code: "risky_alias",
          message: `Alias may be too generic: "${a}"`
        });
      }
    }
  }

  return issues;
}
