import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export async function checkQuota(workspaceId: string): Promise<QuotaCheckResult> {
  const snap = await getDb().collection("workspaces").doc(workspaceId).get();
  if (!snap.exists) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const data = snap.data()!;
  const used = data.quotaUsed ?? 0;
  const limit = data.quotaLimit ?? 0;
  const remaining = Math.max(0, limit - used);

  return { allowed: remaining > 0, used, limit, remaining };
}

export async function consumeCredit(
  workspaceId: string,
  amount = 1,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .update({
      quotaUsed: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function resetQuota(workspaceId: string): Promise<void> {
  await getDb().collection("workspaces").doc(workspaceId).update({
    quotaUsed: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function setQuotaLimit(
  workspaceId: string,
  limit: number,
): Promise<void> {
  await getDb().collection("workspaces").doc(workspaceId).update({
    quotaLimit: limit,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function addCredits(
  workspaceId: string,
  credits: number,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .update({
      quotaLimit: FieldValue.increment(credits),
      updatedAt: FieldValue.serverTimestamp(),
    });
}
