import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUpAction } from "@/lib/actions";

export default function SignupPage() {
  return (
    <main className="app-shell min-h-screen">
      <AuthForm title="Create your Runfolio" action={signUpAction} submitLabel="Create account" includeName />
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-white underline underline-offset-2">
          Log in
        </Link>
      </p>
    </main>
  );
}
