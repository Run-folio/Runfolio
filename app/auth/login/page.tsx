import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/lib/actions";

export default function LoginPage() {
  return (
    <main className="app-shell min-h-screen">
      <AuthForm title="Log in to Runfolio" action={signInAction} submitLabel="Log in" />
      <p className="mt-4 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/auth/signup" className="text-white underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </main>
  );
}
