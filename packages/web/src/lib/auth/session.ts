/**
 * Shared session cookie helpers used by middleware and API routes.
 */

import { routing, type AppLocale } from "@/i18n/routing";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

/** Mirrors Firestore `users.preferredLocale` for Edge middleware (httpOnly). */
export const PREFERRED_LOCALE_COOKIE_NAME = "gs-pref-locale";

export function preferredLocaleCookieOptions(maxAgeSec: number) {
  return {
    maxAge: maxAgeSec,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
  };
}

/**
 * Strip locale prefix from pathname (e.g. `/en/dashboard` → `/dashboard`).
 * Returns null if the path does not start with a supported locale.
 */
export function pathnameWithoutLocale(
  pathname: string,
): { locale: AppLocale; pathWithoutLocale: string } | null {
  for (const loc of routing.locales) {
    if (pathname === `/${loc}`) {
      return { locale: loc, pathWithoutLocale: "/" };
    }
    if (pathname.startsWith(`/${loc}/`)) {
      const rest = pathname.slice(loc.length + 2);
      return { locale: loc, pathWithoutLocale: `/${rest}` };
    }
  }
  return null;
}

/** Paths that skip auth (compare using path *without* locale prefix). */
export function isPublicPath(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === "/" || pathWithoutLocale === "") return true;
  const publicPrefixes = ["/login", "/api/auth/", "/api/billing/webhook"];
  return publicPrefixes.some((p) => pathWithoutLocale.startsWith(p));
}
