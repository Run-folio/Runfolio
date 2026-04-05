"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  getMessages,
  isLocale,
  resolveMessage,
  type Locale,
  type Messages
} from "@/lib/i18n";

const STORAGE = {
  locale: "runfolio_locale",
  textSize: "runfolio_text_size",
  reduceMotion: "runfolio_reduce_motion",
  distanceUnits: "runfolio_distance_units"
} as const;

export type TextSizePreference = "default" | "large";
export type DistanceUnitsPreference = "km" | "miles";

type ShellPreferencesContextValue = {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  messages: Messages;
  t: (path: string) => string;
  textSize: TextSizePreference;
  setTextSize: (s: TextSizePreference) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  distanceUnits: DistanceUnitsPreference;
  setDistanceUnits: (u: DistanceUnitsPreference) => void;
};

const ShellPreferencesContext = createContext<ShellPreferencesContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(STORAGE.locale);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function readTextSize(): TextSizePreference {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem(STORAGE.textSize);
    if (raw === "large" || raw === "default") return raw;
  } catch {
    /* ignore */
  }
  return "default";
}

function readReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE.reduceMotion) === "1";
  } catch {
    return false;
  }
}

function readDistanceUnits(): DistanceUnitsPreference {
  if (typeof window === "undefined") return "km";
  try {
    const raw = localStorage.getItem(STORAGE.distanceUnits);
    if (raw === "miles" || raw === "km") return raw;
  } catch {
    /* ignore */
  }
  return "km";
}

function applyDomHints(
  locale: Locale,
  textSize: TextSizePreference,
  reduceMotion: boolean,
  distanceUnits: DistanceUnitsPreference
) {
  const root = document.documentElement;
  root.setAttribute("lang", locale);
  root.setAttribute("data-text-size", textSize);
  root.setAttribute("data-reduce-motion", reduceMotion ? "on" : "off");
  root.setAttribute("data-distance-units", distanceUnits);
}

export function ShellPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [textSize, setTextSizeState] = useState<TextSizePreference>("default");
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [distanceUnits, setDistanceUnitsState] = useState<DistanceUnitsPreference>("km");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setTextSizeState(readTextSize());
    setReduceMotionState(readReduceMotion());
    setDistanceUnitsState(readDistanceUnits());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyDomHints(locale, textSize, reduceMotion, distanceUnits);
    try {
      localStorage.setItem(STORAGE.locale, locale);
      localStorage.setItem(STORAGE.textSize, textSize);
      localStorage.setItem(STORAGE.reduceMotion, reduceMotion ? "1" : "0");
      localStorage.setItem(STORAGE.distanceUnits, distanceUnits);
    } catch {
      /* ignore */
    }
  }, [locale, textSize, reduceMotion, distanceUnits, hydrated]);

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
  }, []);

  const setTextSize = useCallback((s: TextSizePreference) => {
    setTextSizeState(s);
  }, []);

  const setReduceMotion = useCallback((v: boolean) => {
    setReduceMotionState(v);
  }, []);

  const setDistanceUnits = useCallback((u: DistanceUnitsPreference) => {
    setDistanceUnitsState(u);
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (path: string) => {
      return resolveMessage(messages, path);
    },
    [messages]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages,
      t,
      textSize,
      setTextSize,
      reduceMotion,
      setReduceMotion,
      distanceUnits,
      setDistanceUnits
    }),
    [locale, setLocale, messages, t, textSize, setTextSize, reduceMotion, setReduceMotion, distanceUnits, setDistanceUnits]
  );

  return <ShellPreferencesContext.Provider value={value}>{children}</ShellPreferencesContext.Provider>;
}

export function useShellPreferences(): ShellPreferencesContextValue {
  const ctx = useContext(ShellPreferencesContext);
  if (!ctx) {
    throw new Error("useShellPreferences must be used within ShellPreferencesProvider");
  }
  return ctx;
}
