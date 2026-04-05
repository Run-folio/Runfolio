import { Navbar } from "@/components/navbar";
import { getServerAuthUser } from "@/lib/auth-server";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { demoUser, isSupabaseConfigured } from "@/lib/demo-mode";
import { profilePathFromDisplayName, resolveProfileHrefForSignedInNav } from "@/lib/profile-path-server";
import { createClient } from "@/lib/supabase/server";

export async function AppNavbar() {
  let profileHref = profilePathFromDisplayName(demoUser.name) ?? OVERVIEW_PATH;
  let profileImageUrl: string | null = null;

  if (isSupabaseConfigured()) {
    const { user } = await getServerAuthUser();
    const metaName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null;
    const emailLocal = user?.email ? (user.email.split("@")[0] ?? null) : null;
    const fallbackName = metaName?.trim() || emailLocal || demoUser.name;
    profileHref = profilePathFromDisplayName(fallbackName) ?? OVERVIEW_PATH;

    if (user?.id) {
      try {
        const supabase = await createClient();
        profileHref = await resolveProfileHrefForSignedInNav(supabase, user.id, {
          authDisplayName: metaName,
          emailLocalPart: emailLocal
        });
        const { data } = await supabase.from("users").select("strava_profile_url").eq("id", user.id).maybeSingle();
        const url = (data as { strava_profile_url?: string | null } | null)?.strava_profile_url?.trim();
        profileImageUrl = url || null;
      } catch {
        profileHref = profilePathFromDisplayName(fallbackName) ?? "/settings";
      }
    }
  }

  const profileLabel =
    profileHref === "/settings"
      ? "?"
      : decodeURIComponent(profileHref.replace(/^\//, "")).trim().charAt(0).toUpperCase() || "?";
  const profileInitial = profileLabel;

  return (
    <Navbar profileHref={profileHref} profileInitial={profileInitial} profileImageUrl={profileImageUrl} />
  );
}
