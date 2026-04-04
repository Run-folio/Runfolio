import { en } from "./messages/en";
import { fr } from "./messages/fr";
import { es } from "./messages/es";
import type { Locale, Messages } from "./types";

export type { Locale, Messages } from "./types";

const CATALOG: Record<Locale, Messages> = { en, fr, es };

export const SUPPORTED_LOCALES: Locale[] = ["en", "fr", "es"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "fr" || value === "es";
}

export function getMessages(locale: Locale): Messages {
  return CATALOG[locale] ?? CATALOG.en;
}

/**
 * Dot-path resolver, e.g. `t("footer.about")`.
 */
export function resolveMessage(messages: Messages, path: string): string {
  const parts = path.split(".");
  let cur: unknown = messages as unknown;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : path;
}
