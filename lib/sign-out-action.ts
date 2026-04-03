"use server";

import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getEnvPersistenceFailure } from "@/lib/persistence-readiness";
import { runfolioLog } from "@/lib/runfolio-log";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const envBlock = getEnvPersistenceFailure();
  if (envBlock) {
    runfolioLog.warn("actions.signOut", "no supabase client", { status: envBlock.status });
    redirect("/");
  }
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signOut", e);
    redirect("/auth/login");
  }
}
