import { redirect } from "next/navigation";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Legacy route: Runfolio uses Strava-only sign-in at `/auth/login`.
 */
export default async function SignUpRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? "") ?? "/dashboard";
  redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
}
