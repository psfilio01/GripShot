import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ensureUserProvisioned } from "@/lib/db/users";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  PREFERRED_LOCALE_COOKIE_NAME,
  preferredLocaleCookieOptions,
} from "@/lib/auth/session";
import { isAppLocale } from "@/lib/auth/locale-path";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);

    const { isNew, user } = await ensureUserProvisioned({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    });

    if (isNew) {
      console.log(`New user provisioned: ${decoded.uid} (${decoded.email})`);
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ status: "ok" });
    const maxAgeSec = SESSION_MAX_AGE_MS / 1000;
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: maxAgeSec,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    const pref = user.preferredLocale;
    if (pref && isAppLocale(pref)) {
      response.cookies.set(PREFERRED_LOCALE_COOKIE_NAME, pref, {
        ...preferredLocaleCookieOptions(maxAgeSec),
      });
    } else {
      response.cookies.delete(PREFERRED_LOCALE_COOKIE_NAME);
    }

    return response;
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json(
      { error: "Invalid ID token" },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(PREFERRED_LOCALE_COOKIE_NAME);
  return response;
}
