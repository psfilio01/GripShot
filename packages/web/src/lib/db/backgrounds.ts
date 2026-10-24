import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { BackgroundDoc } from "./types";

export interface CreateBackgroundInput {
  workspaceId: string;
  name: string;
  type: "canvas" | "freestyle" | "upload";
  description: string;
}

function collection(workspaceId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("backgrounds");
}

export async function createBackground(
  input: CreateBackgroundInput,
): Promise<string> {
  const ref = collection(input.workspaceId).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    name: input.name.trim(),
    type: input.type,
    description: (input.description ?? "").trim(),
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listBackgrounds(
  workspaceId: string,
): Promise<(BackgroundDoc & { id: string })[]> {
  const snap = await collection(workspaceId)
    .where("deletedAt", "==", null)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as BackgroundDoc) }));
}

export async function listDeletedBackgrounds(
  workspaceId: string,
): Promise<(BackgroundDoc & { id: string })[]> {
  const snap = await collection(workspaceId)
    .where("deletedAt", "!=", null)
    .orderBy("deletedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as BackgroundDoc) }));
}

export async function getBackground(
  workspaceId: string,
  backgroundId: string,
): Promise<(BackgroundDoc & { id: string }) | null> {
  const snap = await collection(workspaceId).doc(backgroundId).get();
  return snap.exists
    ? { id: snap.id, ...(snap.data() as BackgroundDoc) }
    : null;
}

export async function updateBackground(
  workspaceId: string,
  backgroundId: string,
  data: Partial<Pick<BackgroundDoc, "name" | "description">>,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.description !== undefined) update.description = data.description.trim();
  await collection(workspaceId).doc(backgroundId).update(update);
}

export async function softDeleteBackground(
  workspaceId: string,
  backgroundId: string,
  deletedBy: string,
): Promise<void> {
  await collection(workspaceId).doc(backgroundId).update({
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function restoreBackground(
  workspaceId: string,
  backgroundId: string,
): Promise<void> {
  await collection(workspaceId).doc(backgroundId).update({
    deletedAt: null,
    deletedBy: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function hardDeleteBackground(
  workspaceId: string,
  backgroundId: string,
): Promise<void> {
  await collection(workspaceId).doc(backgroundId).delete();
}
