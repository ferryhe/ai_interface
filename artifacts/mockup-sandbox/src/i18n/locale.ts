export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";
export const LOCALE_STORAGE_KEY = "ai_interface_locale";

export function i18nRiskLevelKey(value: string): `common.riskLevel.${string}` {
  return `common.riskLevel.${value}`;
}

export function i18nStatusKey(value: string): `common.status.${string}` {
  return `common.status.${value}`;
}

export function formatDateTimeForLocale(value: string, locale: AppLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "en" || normalized.startsWith("en-")) return "en-US";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return null;
}

export function detectInitialLocale({
  search,
  storedLocale,
  navigatorLanguage,
}: {
  search: string;
  storedLocale: string | null;
  navigatorLanguage: string | null;
}): AppLocale {
  const params = new URLSearchParams(search);
  return (
    normalizeLocale(params.get("lang")) ??
    normalizeLocale(storedLocale) ??
    normalizeLocale(navigatorLanguage) ??
    DEFAULT_LOCALE
  );
}

export function readBrowserLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  let storedLocale: string | null = null;
  try {
    storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    storedLocale = null;
  }

  return detectInitialLocale({
    search: window.location.search,
    storedLocale,
    navigatorLanguage: window.navigator.language,
  });
}

export function persistLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale persistence is best-effort; the active in-memory language still changes.
  }
}
