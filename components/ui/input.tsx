import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border border-border bg-[#070b12] px-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-teal/50",
        className
      )}
      {...props}
    />
  );
});
