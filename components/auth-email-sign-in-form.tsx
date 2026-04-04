"use client";

import { useActionState, useEffect } from "react";
import {
  signInWithEmailFormAction,
  type EmailAuthFormState
} from "@/lib/auth-email-actions";
import { asFormAction } from "@/lib/server-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: EmailAuthFormState = { error: null, info: null };

type Props = {
  nextPath: string;
  /** When Strava fails, announce email path to screen readers. */
  stravaFailed?: boolean;
};

export function AuthEmailSignInForm({ nextPath, stravaFailed }: Props) {
  const [state, formAction, pending] = useActionState(signInWithEmailFormAction, initial);

  useEffect(() => {
    if (stravaFailed) {
      const el = document.getElementById("email-auth-heading");
      el?.focus();
    }
  }, [stravaFailed]);

  return (
    <div className="space-y-3">
      <h2 id="email-auth-heading" tabIndex={-1} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Sign in with email
      </h2>
      <form action={asFormAction(formAction)} className="space-y-3">
        <input type="hidden" name="next" value={nextPath} />
        <Input name="email" type="email" autoComplete="email" placeholder="Email" required className="w-full" />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          className="w-full"
        />
        {state.error ? (
          <p className="text-xs text-rose-200/95" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
