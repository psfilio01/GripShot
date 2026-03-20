/**
 * Shared session cookie helpers used by middleware and API routes.
 */

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  const publicPrefixes = ["/login", "/api/auth/", "/api/billing/webhook"];
  return publicPrefixes.some((p) => pathname.startsWith(p));
}
