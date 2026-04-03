import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BACKEND_NOT_CONNECTED_USER_MESSAGE } from "@/lib/backend-config-messages";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { signUpAction } from "@/lib/actions";

type Props = { searchParams: Promise<{ next?: string; supabase?: string; setup?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = parseSafeRedirectPath(sp.next ?? "") ?? "/dashboard";
  const setupWarning =
    sp.supabase === "missing"
      ? BACKEND_NOT_CONNECTED_USER_MESSAGE
      : sp.setup
        ? "You’re on the guided setup path — create an account and we’ll continue from there."
        : null;

  return (
    <main className="app-shell min-h-screen">
      <AuthForm
        title="Create your Runfolio"
        action={signUpAction}
        submitLabel="Create account"
        includeName
        nextPath={nextPath}
        setupWarning={setupWarning}
      />
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="text-white underline underline-offset-2">
          Log in
        </Link>
      </p>
    </main>
  );
}
