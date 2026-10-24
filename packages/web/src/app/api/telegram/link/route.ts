import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { createLogger } from "@/lib/logger";
import {
  consumeTelegramLinkToken,
  linkTelegramToUser,
  unlinkTelegram,
} from "@/lib/db/telegram";
import { sendMessage } from "@/lib/telegram/client";

const log = createLogger("api:telegram:link");

/**
 * POST — Link a Telegram chat to the current user.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const tokenData = await consumeTelegramLinkToken(token);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  await linkTelegramToUser(session.user.uid, tokenData.chatId);

  log.info("Telegram account linked", {
    uid: session.user.uid,
    chatId: tokenData.chatId,
  });

  try {
    await sendMessage(
      tokenData.chatId,
      `✅ Verknüpfung erfolgreich! Hallo ${session.user.displayName ?? session.user.email}.\n\nNutze /status oder sende eine Sprachnachricht.`,
    );
  } catch (err) {
    log.warn("Could not send Telegram confirmation", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true, chatId: tokenData.chatId });
}

/** DELETE — Unlink Telegram from the current user. */
export async function DELETE() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await unlinkTelegram(session.user.uid);

  log.info("Telegram account unlinked", { uid: session.user.uid });
  return NextResponse.json({ ok: true });
}

/** GET — Check if the current user has a linked Telegram account. */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    linked: !!session.user.telegramChatId,
    chatId: session.user.telegramChatId ?? null,
  });
}
