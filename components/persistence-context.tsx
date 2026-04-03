"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PersistenceSnapshot } from "@/lib/persistence-snapshot";

const PersistenceContext = createContext<PersistenceSnapshot | null>(null);

export function PersistenceProvider({
  value,
  children
}: {
  value: PersistenceSnapshot;
  children: ReactNode;
}) {
  return <PersistenceContext.Provider value={value}>{children}</PersistenceContext.Provider>;
}

/** Safe defaults if provider is missing (treat as no persistence). */
export function usePersistence(): PersistenceSnapshot {
  const ctx = useContext(PersistenceContext);
  if (!ctx) {
    return {
      persistenceAvailable: false,
      offlineDemo: false,
      missingSupabaseEnv: true,
      reason: "App configuration is not ready — saves may not work."
    };
  }
  return ctx;
}
