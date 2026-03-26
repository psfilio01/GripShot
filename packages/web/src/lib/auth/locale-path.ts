import { routing, type AppLocale } from "@/i18n/routing";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return (
    value !== undefined &&
    routing.locales.includes(value as AppLocale)
  );
}

/**
 * Build pathname with locale prefix from path without locale (e.g. `/dashboard` → `/de/dashboard`).
 */
export function pathnameWithLocale(
  pathWithoutLocale: string,
  locale: AppLocale,
): string {
  if (pathWithoutLocale === "/" || pathWithoutLocale === "") {
    return `/${locale}`;
  }
  return `/${locale}${pathWithoutLocale}`;
}
