import { fetchStravaAthleteActivities, type StravaSummaryActivityJson } from "@/lib/strava-api";

const MAX_PAGES = 40;
const PER_PAGE = 50;
const MAX_ACTIVITIES = 1400;

/** Paginated Strava athlete/activities list (newest first). */
export async function fetchAllStravaActivitySummaries(accessToken: string): Promise<StravaSummaryActivityJson[]> {
  const all: StravaSummaryActivityJson[] = [];
  for (let page = 1; page <= MAX_PAGES && all.length < MAX_ACTIVITIES; page++) {
    const batch = await fetchStravaAthleteActivities(accessToken, { page, perPage: PER_PAGE });
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}
