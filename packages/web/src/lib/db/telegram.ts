import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { UserDoc } from "./types";

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a one-time link token and store it in Firestore so the
 * settings page can later verify it and bind a Telegram chatId to a user.
 */
export async function createTelegramLinkToken(
  telegramChatId: number,
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const db = getDb();

  await db.collection("telegramLinkTokens").doc(token).set({
    chatId: telegramChatId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS),
  });

  return token;
}

export interface LinkTokenData {
  chatId: number;
  expiresAt: Date;
}

export async function consumeTelegramLinkToken(
  token: string,
): Promise<LinkTokenData | null> {
  const db = getDb();
  const ref = db.collection("telegramLinkTokens").doc(token);
  const snap = await ref.get();

  if (!snap.exists) return null;

  const data = snap.data()!;
  const expiresAt: Date =
    data.expiresAt instanceof Date
      ? data.expiresAt
      : data.expiresAt.toDate();

  if (expiresAt < new Date()) {
    await ref.delete();
    return null;
  }

  await ref.delete();
  return { chatId: data.chatId, expiresAt };
}

export async function linkTelegramToUser(
  uid: string,
  chatId: number,
): Promise<void> {
  const db = getDb();
  await db
    .collection("users")
    .doc(uid)
    .update({
      telegramChatId: chatId,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function unlinkTelegram(uid: string): Promise<void> {
  const db = getDb();
  await db.collection("users").doc(uid).update({
    telegramChatId: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getUserByTelegramChatId(
  chatId: number,
): Promise<UserDoc | null> {
  const db = getDb();
  const snap = await db
    .collection("users")
    .where("telegramChatId", "==", chatId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data() as UserDoc;
}
