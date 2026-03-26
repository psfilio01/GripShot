import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import {
  SESSION_COOKIE_NAME,
  isPublicPath,
  pathnameWithoutLocale,
} from "@/lib/auth/session";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const stripped = pathnameWithoutLocale(pathname);

  if (!stripped) {
    return intlResponse;
  }

  const { locale, pathWithoutLocale } = stripped;

  if (isPublicPath(pathWithoutLocale)) {
    return intlResponse;
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
