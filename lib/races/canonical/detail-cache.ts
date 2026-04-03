import { cache } from "react";
import {
  getActiveCanonicalRaceByRef,
  type RepositoryResult
} from "@/lib/races/canonical/repository";
import type { CanonicalRace } from "@/lib/races/canonical/types";

/** Dedupes canonical detail resolution within one request (e.g. `generateMetadata` + page). */
export const getCachedCanonicalDetailResult = cache(
  async (ref: string): Promise<RepositoryResult<CanonicalRace | null>> => {
    return getActiveCanonicalRaceByRef(ref);
  }
);
