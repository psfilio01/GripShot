import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { handleUpdate } from "@/lib/telegram/handlers";
import type { TelegramUpdate } from "@/lib/telegram/types";

const log = createLogger("api:telegram:webhook");

/**
 * Telegram Bot webhook endpoint.
 *
 * Telegram sends JSON POST requests here for every update (message, callback, etc.).
 * We always return 200 quickly — errors are logged but not surfaced to Telegram
 * (otherwise Telegram retries and the user sees duplicate messages).
 */
export async function POST(req: NextRequest) {
  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    log.warn("Invalid JSON in webhook request");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  log.debug("Incoming Telegram update", { updateId: body.update_id });

  // Fire-and-forget: process asynchronously so Telegram gets a fast 200.
  // On serverless (Cloud Run / Vercel) the platform keeps the function alive
  // until the microtask queue is drained after the response is sent.
  handleUpdate(body).catch((err) => {
    log.error("Unhandled error in update handler", {
      updateId: body.update_id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ ok: true });
}
