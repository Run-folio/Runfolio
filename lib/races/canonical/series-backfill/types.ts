/** Structured log line for human / JSON review. */
export type SeriesBackfillLogEntry =
  | {
      kind: "series_proposed";
      groupingKey: string;
      proposedSlug: string;
      proposedSeriesName: string;
      city: string | null;
      country: string | null;
      editionCount: number;
      distinctYears: number[];
      rationale: string;
    }
  | {
      kind: "series_inserted" | "series_reused";
      seriesId: string;
      slug: string;
      name: string;
      dryRun: boolean;
    }
  | {
      kind: "edition_linked";
      editionId: string;
      editionName: string;
      seriesId: string;
      groupingKey: string;
      city: string | null;
      country: string | null;
      rationale: string;
      dryRun: boolean;
    }
  | {
      kind: "edition_skipped_ambiguous";
      editionId: string;
      editionName: string;
      groupingKey: string;
      reason: string;
      city: string | null;
      country: string | null;
    }
  | {
      kind: "group_skipped";
      groupingKey: string;
      reason: string;
      editionIds: string[];
    }
  | {
      kind: "alias_proposed" | "alias_inserted";
      scope: "series" | "edition";
      targetId: string;
      aliasText: string;
      aliasNormalized: string;
      aliasKind: string;
      source: string;
      rationale: string;
      dryRun: boolean;
    }
  | {
      kind: "alias_skipped_risky";
      scope: "series" | "edition";
      targetId: string;
      aliasText: string;
      reason: string;
    };

export type SeriesBackfillSummary = {
  proposedSeriesCount: number;
  insertedSeriesCount: number;
  reusedSeriesCount: number;
  linkedEditionsCount: number;
  skippedAmbiguousEditionsCount: number;
  skippedGroupsCount: number;
  proposedAliasesCount: number;
  insertedAliasesCount: number;
  skippedRiskyAliasesCount: number;
};

export type SeriesBackfillResult = {
  summary: SeriesBackfillSummary;
  logs: SeriesBackfillLogEntry[];
};
