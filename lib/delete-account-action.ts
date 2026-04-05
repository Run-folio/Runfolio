"use server";

import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { runfolioLog } from "@/lib/runfolio-log";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function deleteAccountAction(): Promise<{ error: string } | void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      redirect("/auth/login?next=" + encodeURIComponent("/settings"));
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return { error: "Account deletion isn’t available on this server." };
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      runfolioLog.error("deleteAccountAction", delErr, { userId: user.id });
      return { error: delErr.message || "Could not delete account." };
    }

    try {
      await supabase.auth.signOut();
    } catch {
      /* session may already be invalid */
    }
    redirect("/");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("deleteAccountAction", e);
    return { error: "Something went wrong." };
  }
}
