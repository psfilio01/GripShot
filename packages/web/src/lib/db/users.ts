import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { UserDoc, WorkspaceDoc } from "./types";

const FREE_PLAN_QUOTA = 50;

export async function ensureUserProvisioned(decoded: {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}): Promise<{ user: UserDoc; workspace: WorkspaceDoc; isNew: boolean }> {
  const db = getDb();
  const userRef = db.collection("users").doc(decoded.uid);
  const snap = await userRef.get();

  if (snap.exists) {
    const user = snap.data() as UserDoc;
    const wsSnap = await db
      .collection("workspaces")
      .doc(user.workspaceId)
      .get();
    return {
      user,
      workspace: wsSnap.data() as WorkspaceDoc,
      isNew: false,
    };
  }

  const workspaceRef = db.collection("workspaces").doc();
  const now = FieldValue.serverTimestamp();

  const workspaceData: Omit<WorkspaceDoc, "createdAt" | "updatedAt"> & {
    createdAt: typeof now;
    updatedAt: typeof now;
  } = {
    name: decoded.name ? `${decoded.name}'s workspace` : "My workspace",
    ownerUid: decoded.uid,
    plan: "free",
    quotaUsed: 0,
    quotaLimit: FREE_PLAN_QUOTA,
    createdAt: now,
    updatedAt: now,
  };

  const userData: Omit<UserDoc, "createdAt" | "updatedAt"> & {
    createdAt: typeof now;
    updatedAt: typeof now;
  } = {
    uid: decoded.uid,
    email: decoded.email ?? "",
    displayName: decoded.name ?? null,
    photoURL: decoded.picture ?? null,
    workspaceId: workspaceRef.id,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(userRef, userData);
  batch.set(workspaceRef, workspaceData);
  await batch.commit();

  const [newUserSnap, newWsSnap] = await Promise.all([
    userRef.get(),
    workspaceRef.get(),
  ]);

  return {
    user: newUserSnap.data() as UserDoc,
    workspace: newWsSnap.data() as WorkspaceDoc,
    isNew: true,
  };
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const snap = await getDb().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as UserDoc) : null;
}

export async function getWorkspace(
  workspaceId: string,
): Promise<WorkspaceDoc | null> {
  const snap = await getDb().collection("workspaces").doc(workspaceId).get();
  return snap.exists ? (snap.data() as WorkspaceDoc) : null;
}

export async function updateUserPreferredLocale(
  uid: string,
  locale: "en" | "de" | null,
): Promise<void> {
  const userRef = getDb().collection("users").doc(uid);
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (locale === null) {
    update.preferredLocale = FieldValue.delete();
  } else {
    update.preferredLocale = locale;
  }
  await userRef.update(update);
}
