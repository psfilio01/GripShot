import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/server-session";
import { updateUserPreferredLocale } from "@/lib/db/users";
import {
  SESSION_MAX_AGE_MS,
  PREFERRED_LOCALE_COOKIE_NAME,
  preferredLocaleCookieOptions,
} from "@/lib/auth/session";
import { isAppLocale } from "@/lib/auth/locale-path";

const PatchBodySchema = z.object({
  preferredLocale: z.union([z.literal("en"), z.literal("de"), z.null()]),
});

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pref = session.user.preferredLocale;
  return NextResponse.json({
    preferredLocale:
      pref && isAppLocale(pref) ? pref : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { preferredLocale } = parsed.data;
  await updateUserPreferredLocale(session.user.uid, preferredLocale);

  const response = NextResponse.json({
    preferredLocale,
  });
  const maxAgeSec = SESSION_MAX_AGE_MS / 1000;
  if (preferredLocale) {
    response.cookies.set(
      PREFERRED_LOCALE_COOKIE_NAME,
      preferredLocale,
      preferredLocaleCookieOptions(maxAgeSec),
    );
  } else {
    response.cookies.delete(PREFERRED_LOCALE_COOKIE_NAME);
  }

  return response;
}
