import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  const variants = {
    primary: "bg-accent text-white hover:bg-[#f08a4d]",
    secondary: "bg-panelAlt border border-border text-white hover:bg-slate-800",
    ghost: "text-muted hover:text-white"
  };

  return (
    <button
      className={cn(
        "rounded-[12px] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
