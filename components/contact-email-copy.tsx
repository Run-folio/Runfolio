"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  className?: string;
};

export function ContactEmailCopy({ email, className }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }, [email]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/14 bg-white/[0.04] px-5 text-[13px] font-medium text-white/80 transition hover:border-white/22 hover:bg-white/[0.07] hover:text-white active:scale-[0.99]",
        className
      )}
    >
      {copied ? "Copied" : "Copy email"}
    </button>
  );
}
