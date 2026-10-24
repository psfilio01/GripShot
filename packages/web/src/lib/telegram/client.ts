import { createLogger } from "@/lib/logger";
import type {
  SendMessageParams,
  TelegramFile,
  TelegramInlineKeyboardMarkup,
} from "./types";

const log = createLogger("telegram:client");

const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

function apiUrl(method: string): string {
  return `${TELEGRAM_API}/bot${getToken()}/${method}`;
}

async function callApi<T>(method: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.ok) {
    log.error("Telegram API error", {
      method,
      status: res.status,
      description: data.description,
    });
    throw new Error(`Telegram API ${method}: ${data.description ?? res.status}`);
  }

  return data.result as T;
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    replyMarkup?: TelegramInlineKeyboardMarkup;
  },
): Promise<void> {
  const params: SendMessageParams = {
    chat_id: chatId,
    text,
    parse_mode: opts?.parseMode,
    reply_markup: opts?.replyMarkup,
  };

  await callApi("sendMessage", params);
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  opts?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    replyMarkup?: TelegramInlineKeyboardMarkup;
  },
): Promise<void> {
  await callApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts?.parseMode,
    reply_markup: opts?.replyMarkup,
  });
}

export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: TelegramInlineKeyboardMarkup,
): Promise<void> {
  await callApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
}

/**
 * Send a photo (as a Buffer) to a Telegram chat using multipart/form-data.
 * Telegram requires multipart encoding when uploading binary data.
 */
export async function sendPhoto(
  chatId: number,
  photo: Buffer,
  opts?: {
    caption?: string;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    replyMarkup?: TelegramInlineKeyboardMarkup;
    filename?: string;
  },
): Promise<number> {
  const form = new FormData();
  form.append("chat_id", String(chatId));

  const blob = new Blob([new Uint8Array(photo)], { type: "image/png" });
  form.append("photo", blob, opts?.filename ?? "image.png");

  if (opts?.caption) form.append("caption", opts.caption);
  if (opts?.parseMode) form.append("parse_mode", opts.parseMode);
  if (opts?.replyMarkup) {
    form.append("reply_markup", JSON.stringify(opts.replyMarkup));
  }

  const res = await fetch(apiUrl("sendPhoto"), {
    method: "POST",
    body: form,
  });

  const data = await res.json();

  if (!data.ok) {
    log.error("Telegram sendPhoto error", {
      status: res.status,
      description: data.description,
    });
    throw new Error(`Telegram API sendPhoto: ${data.description ?? res.status}`);
  }

  return (data.result as { message_id: number }).message_id;
}

export async function getFile(fileId: string): Promise<TelegramFile> {
  return callApi<TelegramFile>("getFile", { file_id: fileId });
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const url = `${TELEGRAM_API}/file/bot${getToken()}/${filePath}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }

  return res.arrayBuffer();
}
