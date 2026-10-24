import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { TelegramState, TelegramStatePhase } from "@/lib/telegram/types";

/** Nested map keys that need FieldValue.delete() for undefined values. */
const NESTED_MAP_KEYS = new Set(["pendingSettings", "pendingResource"]);

/**
 * Firestore rejects `undefined` anywhere in document data. Optional clears on merge
 * must use FieldValue.delete(); nested maps must not contain undefined values.
 */
export function telegramStateToFirestoreMergePayload(
  state: Partial<TelegramState>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (NESTED_MAP_KEYS.has(key)) {
      if (value === undefined) {
        result[key] = FieldValue.delete();
        continue;
      }
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const cleaned: Record<string, unknown> = {};
        for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
          cleaned[sk] = sv === undefined ? FieldValue.delete() : sv;
        }
        result[key] = cleaned;
      }
      continue;
    }
    if (value === undefined) {
      result[key] = FieldValue.delete();
      continue;
    }
    result[key] = value;
  }
  return result;
}

function stateDocRef(uid: string) {
  return getDb().collection("users").doc(uid).collection("telegramState").doc("current");
}

const DEFAULT_STATE: TelegramState = {
  phase: "idle",
  updatedAt: Date.now(),
};

export async function getTelegramState(uid: string): Promise<TelegramState> {
  const snap = await stateDocRef(uid).get();
  if (!snap.exists) return { ...DEFAULT_STATE };
  return snap.data() as TelegramState;
}

export async function setTelegramState(
  uid: string,
  state: Partial<TelegramState>,
): Promise<void> {
  const payload = telegramStateToFirestoreMergePayload(state);
  await stateDocRef(uid).set(
    { ...payload, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function resetTelegramState(uid: string): Promise<void> {
  await stateDocRef(uid).set({ ...DEFAULT_STATE, updatedAt: Date.now() });
}

export async function setTelegramPhase(
  uid: string,
  phase: TelegramStatePhase,
  extra?: Partial<TelegramState>,
): Promise<void> {
  await setTelegramState(uid, { phase, ...extra });
}
