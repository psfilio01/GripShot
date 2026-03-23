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
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listBackgrounds(
  workspaceId: string,
): Promise<(BackgroundDoc & { id: string })[]> {
  const snap = await collection(workspaceId).orderBy("createdAt", "desc").get();
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

export async function deleteBackground(
  workspaceId: string,
  backgroundId: string,
): Promise<void> {
  await collection(workspaceId).doc(backgroundId).delete();
}
