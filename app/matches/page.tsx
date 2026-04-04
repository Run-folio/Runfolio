import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy route: Match & Import merged into My Races.
 */
export default function MatchHubPageRedirect() {
  redirect("/my-races");
}
