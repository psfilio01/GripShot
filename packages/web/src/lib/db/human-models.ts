import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { HumanModelDoc } from "./types";

export interface CreateHumanModelInput {
  workspaceId: string;
  displayName: string;
  notes?: string;
  source?: "human" | "ai";
  aiPrompt?: string;
  gender?: string;
  ageRange?: string;
  bodyBuild?: string;
  ethnicity?: string;
  hairColor?: string;
  hairLength?: string;
  skinTone?: string;
  height?: string;
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
  const snap = await collection(workspaceId).where("deletedAt", "==", null).get();
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

export async function listDeletedHumanModels(
  workspaceId: string,
): Promise<(HumanModelDoc & { id: string })[]> {
  const snap = await collection(workspaceId)
    .where("deletedAt", "!=", null)
    .orderBy("deletedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as HumanModelDoc) }));
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
  const doc: Record<string, unknown> = {
    displayName: input.displayName.trim(),
    notes: (input.notes ?? "").trim(),
    source: input.source ?? "human",
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  if (input.aiPrompt) doc.aiPrompt = input.aiPrompt;
  if (input.gender) doc.gender = input.gender;
  if (input.ageRange) doc.ageRange = input.ageRange;
  if (input.bodyBuild) doc.bodyBuild = input.bodyBuild;
  if (input.ethnicity) doc.ethnicity = input.ethnicity;
  if (input.hairColor) doc.hairColor = input.hairColor;
  if (input.hairLength) doc.hairLength = input.hairLength;
  if (input.skinTone) doc.skinTone = input.skinTone;
  if (input.height) doc.height = input.height;
  await ref.set(doc);
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

export async function softDeleteHumanModelDoc(
  workspaceId: string,
  modelId: string,
  deletedBy: string,
): Promise<void> {
  await collection(workspaceId).doc(modelId).update({
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function restoreHumanModelDoc(
  workspaceId: string,
  modelId: string,
): Promise<void> {
  await collection(workspaceId).doc(modelId).update({
    deletedAt: null,
    deletedBy: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function hardDeleteHumanModelDoc(
  workspaceId: string,
  modelId: string,
): Promise<void> {
  await collection(workspaceId).doc(modelId).delete();
}

export async function listHumanModelIds(workspaceId: string): Promise<string[]> {
  const models = await listHumanModels(workspaceId);
  return models.map((m) => m.id);
}
