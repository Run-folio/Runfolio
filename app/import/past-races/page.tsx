import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy route: Past races import lives on My Races (#import-strava).
 */
export default function ImportPastRacesPageRedirect() {
  redirect("/my-races");
}
