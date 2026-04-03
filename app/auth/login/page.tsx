import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { signInAction } from "@/lib/actions";

type Props = {
  searchParams: Promise<{ next?: string; redirect?: string; supabase?: string; setup?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? sp.redirect ?? "") ?? "/dashboard";
  const setupWarning =
    sp.supabase === "missing"
      ? BACKEND_NOT_CONNECTED_USER_MESSAGE
      : sp.setup
        ? "You’re on the guided setup path — sign in and we’ll pick up where you left off."
        : null;

  return (
    <main className="app-shell min-h-screen">
      <AuthForm
        title="Log in to Runfolio"
        action={signInAction}
        submitLabel="Log in"
        nextPath={nextPath}
        setupWarning={setupWarning}
      />
      <p className="mt-4 text-center text-sm text-muted">
        No account?{" "}
        <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="text-white underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </main>
  );
}
