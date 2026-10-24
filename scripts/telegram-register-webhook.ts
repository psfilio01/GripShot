#!/usr/bin/env npx tsx
/**
 * Register (or remove) the Telegram Bot webhook.
 *
 * Usage:
 *   npx tsx scripts/telegram-register-webhook.ts                   # registers using env vars
 *   npx tsx scripts/telegram-register-webhook.ts --delete           # removes the webhook
 *   npx tsx scripts/telegram-register-webhook.ts --info             # shows current webhook info
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN      — from BotFather
 *   TELEGRAM_WEBHOOK_URL    — e.g. https://your-app.run.app/api/telegram/webhook
 *                              or ngrok URL for local dev
 */

import "dotenv/config";

/** Minimal shape for Telegram Bot API JSON responses used by this script. */
type TelegramApiResponse<R = unknown> = {
  ok: boolean;
  description?: string;
  result?: R;
};

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function main() {
  if (!TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not set");
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes("--info")) {
    const res = await fetch(`${API}/getWebhookInfo`);
    const data = (await res.json()) as TelegramApiResponse;
    console.log("Webhook info:", JSON.stringify(data.result, null, 2));
    return;
  }

  if (args.includes("--delete")) {
    const res = await fetch(`${API}/deleteWebhook`);
    const data = (await res.json()) as TelegramApiResponse;
    console.log(data.ok ? "✅ Webhook removed" : `❌ ${data.description ?? "unknown error"}`);
    return;
  }

  if (!WEBHOOK_URL) {
    console.error("❌ TELEGRAM_WEBHOOK_URL is not set");
    process.exit(1);
  }

  const url = `${API}/setWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ["message", "callback_query"],
    }),
  });

  const data = (await res.json()) as TelegramApiResponse;

  if (data.ok) {
    console.log(`✅ Webhook registered: ${WEBHOOK_URL}`);
  } else {
    console.error(`❌ Failed: ${data.description ?? "unknown error"}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
