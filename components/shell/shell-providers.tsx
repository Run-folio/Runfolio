"use client";

import type { ReactNode } from "react";
import { ShellPreferencesProvider } from "@/components/shell/shell-preferences-context";

export function ShellProviders({ children }: { children: ReactNode }) {
  return <ShellPreferencesProvider>{children}</ShellPreferencesProvider>;
}
