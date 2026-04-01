import type { ComponentProps } from "react";

/**
 * React 19 types `<form action>` as void-only; server actions often return `{ error }`.
 * Use this at the boundary so builds stay strict without losing error returns at runtime.
 */
export function asFormAction<T extends (formData: FormData) => unknown>(
  action: T
): NonNullable<ComponentProps<"form">["action"]> {
  return action as NonNullable<ComponentProps<"form">["action"]>;
}
