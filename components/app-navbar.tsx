import { Navbar } from "@/components/navbar";
import { getServerAuthUser } from "@/lib/auth-server";
import { demoUser, isSupabaseConfigured } from "@/lib/demo-mode";

export async function AppNavbar() {
  let profileName = demoUser.name;
  if (isSupabaseConfigured()) {
    const { user } = await getServerAuthUser();
    if (user?.user_metadata?.name && typeof user.user_metadata.name === "string") {
      profileName = user.user_metadata.name;
    } else if (user?.email) {
      profileName = user.email.split("@")[0] ?? profileName;
    }
  }
  const profileHref = `/${encodeURIComponent(profileName)}`;
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || "?";

  return <Navbar profileHref={profileHref} profileInitial={profileInitial} />;
}
