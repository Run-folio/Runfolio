"use server";

import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { ensurePublicUserRow } from "@/lib/ensure-public-user-row";
import { getEnvPersistenceFailure } from "@/lib/persistence-readiness";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { createClient } from "@/lib/supabase/server";
import { runfolioLog } from "@/lib/runfolio-log";

export type EmailAuthFormState = { error: string | null; info: string | null };

export type EmailSignUpFormState = { error: string | null; success: string | null };

function friendlyAuthMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Email or password doesn’t match our records.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first, then try signing in again.";
  }
  if (m.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("password")) {
    return "Choose a stronger password (at least 6 characters).";
  }
  return "Something went wrong. Try again.";
}

export async function signInWithEmailAction(formData: FormData) {
  try {
    const envBlock = getEnvPersistenceFailure();
    if (envBlock) return { error: "Sign-in isn’t available right now. Check your connection or try again later." };

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextRaw = String(formData.get("next") ?? OVERVIEW_PATH);
    const next = parseSafeRedirectPath(nextRaw) ?? OVERVIEW_PATH;

    if (!email || !password) {
      return { error: "Enter your email and password." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      runfolioLog.warn("auth.email.signIn", error.message);
      return { error: friendlyAuthMessage(error.message) };
    }

    if (data.user) {
      const ensured = await ensurePublicUserRow(supabase, data.user);
      if (!ensured.ok) {
        runfolioLog.warn("auth.email.signIn.ensureUser", ensured.error);
      }
    }

    redirect(next);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("auth.email.signIn", e);
    return { error: "Couldn’t sign you in. Try again." };
  }
}

/** For `useActionState` on the login form (redirect on success). */
export async function signInWithEmailFormAction(
  _prev: EmailAuthFormState,
  formData: FormData
): Promise<EmailAuthFormState> {
  const r = await signInWithEmailAction(formData);
  if (r && "error" in r) return { error: r.error ?? "Something went wrong.", info: null };
  return { error: null, info: null };
}

/** For `useActionState` on the sign-up form. */
export async function signUpWithEmailFormAction(
  _prev: EmailSignUpFormState,
  formData: FormData
): Promise<EmailSignUpFormState> {
  const r = await signUpWithEmailAction(formData);
  if (r && "error" in r) return { error: r.error ?? "Something went wrong.", success: null };
  if (r && "ok" in r && r.ok) return { error: null, success: r.message ?? "Check your email to confirm your account." };
  return { error: null, success: null };
}

export async function signUpWithEmailAction(formData: FormData) {
  try {
    const envBlock = getEnvPersistenceFailure();
    if (envBlock) return { error: "Creating an account isn’t available right now. Try again later." };

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const nextRaw = String(formData.get("next") ?? OVERVIEW_PATH);
    const next = parseSafeRedirectPath(nextRaw) ?? OVERVIEW_PATH;

    if (!email || !password) {
      return { error: "Enter your email and a password." };
    }
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { name } : undefined
      }
    });

    if (error) {
      runfolioLog.warn("auth.email.signUp", error.message);
      return { error: friendlyAuthMessage(error.message) };
    }

    if (data.session?.user) {
      const ensured = await ensurePublicUserRow(supabase, data.session.user);
      if (!ensured.ok) {
        runfolioLog.warn("auth.email.signUp.ensureUser", ensured.error);
      }
      redirect(next);
    }

    return {
      ok: true as const,
      message: "Check your email to confirm your account, then sign in."
    };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("auth.email.signUp", e);
    return { error: "Couldn’t create your account. Try again." };
  }
}
