import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { HumanModelDoc } from "./types";

export interface CreateHumanModelInput {
  workspaceId: string;
  displayName: string;
  notes?: string;
}

function collection(workspaceId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("humanModels");
}

export async function listHumanModels(
  workspaceId: string,
): Promise<(HumanModelDoc & { id: string })[]> {
  const snap = await collection(workspaceId).get();
  const rows = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as HumanModelDoc),
  }));
  rows.sort((a, b) => {
    const ta =
      typeof (a.createdAt as { toMillis?: () => number })?.toMillis === "function"
        ? (a.createdAt as { toMillis: () => number }).toMillis()
        : 0;
    const tb =
      typeof (b.createdAt as { toMillis?: () => number })?.toMillis === "function"
        ? (b.createdAt as { toMillis: () => number }).toMillis()
        : 0;
    return tb - ta;
  });
  return rows;
}

export async function getHumanModel(
  workspaceId: string,
  modelId: string,
): Promise<(HumanModelDoc & { id: string }) | null> {
  const snap = await collection(workspaceId).doc(modelId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as HumanModelDoc) };
}

export async function createHumanModel(
  input: CreateHumanModelInput,
): Promise<string> {
  const ref = collection(input.workspaceId).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    displayName: input.displayName.trim(),
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateHumanModel(
  workspaceId: string,
  modelId: string,
  data: Partial<Pick<HumanModelDoc, "displayName" | "notes">>,
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (data.displayName !== undefined) update.displayName = data.displayName.trim();
  if (data.notes !== undefined) update.notes = data.notes.trim();
  await collection(workspaceId).doc(modelId).update(update);
}

export async function deleteHumanModelDoc(
  workspaceId: string,
  modelId: string,
): Promise<void> {
  await collection(workspaceId).doc(modelId).delete();
}

export async function listHumanModelIds(workspaceId: string): Promise<string[]> {
  const models = await listHumanModels(workspaceId);
  return models.map((m) => m.id);
}
