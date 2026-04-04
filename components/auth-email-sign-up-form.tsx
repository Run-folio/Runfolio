"use client";

import { useActionState } from "react";
import {
  signUpWithEmailFormAction,
  type EmailSignUpFormState
} from "@/lib/auth-email-actions";
import { asFormAction } from "@/lib/server-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: EmailSignUpFormState = { error: null, success: null };

type Props = {
  nextPath: string;
};

export function AuthEmailSignUpForm({ nextPath }: Props) {
  const [state, formAction, pending] = useActionState(signUpWithEmailFormAction, initial);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold uppercase tracking-[0.06em]">Create account</h1>
      <form action={asFormAction(formAction)} className="space-y-3">
        <input type="hidden" name="next" value={nextPath} />
        <Input name="name" type="text" autoComplete="name" placeholder="Name (optional)" className="w-full" />
        <Input name="email" type="email" autoComplete="email" placeholder="Email" required className="w-full" />
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Password (6+ characters)"
          required
          minLength={6}
          className="w-full"
        />
        {state.error ? (
          <p className="text-xs text-rose-200/95" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-xs text-emerald-200/95" role="status">
            {state.success}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
