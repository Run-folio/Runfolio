import { Navbar } from "@/components/navbar";
import { getServerAuthUser } from "@/lib/auth-server";
import { demoUser, isSupabaseConfigured } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

export async function AppNavbar() {
  let profileName = demoUser.name;
  let profileImageUrl: string | null = null;
  if (isSupabaseConfigured()) {
    const { user } = await getServerAuthUser();
    if (user?.user_metadata?.name && typeof user.user_metadata.name === "string") {
      profileName = user.user_metadata.name;
    } else if (user?.email) {
      profileName = user.email.split("@")[0] ?? profileName;
    }
    if (user?.id) {
      try {
        const supabase = await createClient();
        const { data } = await supabase.from("users").select("strava_profile_url").eq("id", user.id).maybeSingle();
        const url = (data as { strava_profile_url?: string | null } | null)?.strava_profile_url?.trim();
        profileImageUrl = url || null;
      } catch {
        profileImageUrl = null;
      }
    }
  }
  const profileHref = `/${encodeURIComponent(profileName)}`;
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || "?";

  return (
    <Navbar profileHref={profileHref} profileInitial={profileInitial} profileImageUrl={profileImageUrl} />
  );
}
