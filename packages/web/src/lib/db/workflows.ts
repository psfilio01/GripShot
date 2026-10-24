import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type {
  WorkflowDoc,
  WorkflowStepDoc,
  WorkflowStepColorVariant,
  WorkflowGlobalSettings,
} from "./types";

export interface CreateWorkflowInput {
  userId: string;
  workspaceId: string;
  name: string;
  description: string;
  globalSettings: WorkflowGlobalSettings;
}

export interface CreateWorkflowStepInput {
  index: number;
  type: "image" | "text" | "image_with_text";
  title: string;
  description: string;
  promptConfig: Record<string, unknown>;
}

function workflowCollection(workspaceId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("workflows");
}

function stepCollection(workspaceId: string, workflowId: string) {
  return workflowCollection(workspaceId).doc(workflowId).collection("steps");
}

export async function createWorkflow(
  input: CreateWorkflowInput,
): Promise<string> {
  const ref = workflowCollection(input.workspaceId).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    userId: input.userId,
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    description: input.description.trim(),
    status: "draft",
    globalSettings: input.globalSettings,
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function getWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<(WorkflowDoc & { id: string }) | null> {
  const snap = await workflowCollection(workspaceId).doc(workflowId).get();
  return snap.exists
    ? { id: snap.id, ...(snap.data() as WorkflowDoc) }
    : null;
}

export async function listWorkflows(
  workspaceId: string,
): Promise<(WorkflowDoc & { id: string })[]> {
  const snap = await workflowCollection(workspaceId)
    .where("deletedAt", "==", null)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WorkflowDoc) }));
}

export async function listDeletedWorkflows(
  workspaceId: string,
): Promise<(WorkflowDoc & { id: string })[]> {
  const snap = await workflowCollection(workspaceId)
    .where("deletedAt", "!=", null)
    .orderBy("deletedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WorkflowDoc) }));
}

export async function updateWorkflow(
  workspaceId: string,
  workflowId: string,
  data: Partial<Pick<WorkflowDoc, "name" | "description" | "status">> & {
    globalSettings?: Partial<WorkflowGlobalSettings>;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.description !== undefined)
    update.description = data.description.trim();
  if (data.status !== undefined) update.status = data.status;
  if (data.globalSettings !== undefined) {
    const wf = await getWorkflow(workspaceId, workflowId);
    if (!wf) throw new Error("Workflow not found");
    const merged: WorkflowGlobalSettings = {
      ...wf.globalSettings,
      ...data.globalSettings,
    };
    const optionalStringKeys: (keyof WorkflowGlobalSettings)[] = [
      "modelId",
      "backgroundId",
      "outfit",
      "language",
      "aspectRatio",
      "resolution",
      "imageModel",
      "productId",
    ];
    for (const k of optionalStringKeys) {
      if (merged[k] === "") {
        delete merged[k];
      }
    }
    update.globalSettings = merged;
  }
  await workflowCollection(workspaceId).doc(workflowId).update(update);
}

export async function getWorkflowSteps(
  workspaceId: string,
  workflowId: string,
): Promise<(WorkflowStepDoc & { id: string })[]> {
  const snap = await stepCollection(workspaceId, workflowId)
    .orderBy("index", "asc")
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as WorkflowStepDoc),
  }));
}

export async function setWorkflowSteps(
  workspaceId: string,
  workflowId: string,
  steps: CreateWorkflowStepInput[],
): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  const col = stepCollection(workspaceId, workflowId);

  const existing = await col.get();
  for (const doc of existing.docs) {
    batch.delete(doc.ref);
  }

  const now = FieldValue.serverTimestamp();
  for (const step of steps) {
    const ref = col.doc();
    batch.set(ref, {
      index: step.index,
      type: step.type,
      title: step.title,
      description: step.description,
      promptConfig: step.promptConfig,
      status: "planned" as const,
      createdAt: now,
    });
  }

  batch.update(workflowCollection(workspaceId).doc(workflowId), {
    status: "planned",
    updatedAt: now,
  });

  await batch.commit();
}

export async function updateWorkflowStep(
  workspaceId: string,
  workflowId: string,
  stepIndex: number,
  data: {
    status?: WorkflowStepDoc["status"];
    resultImagePath?: string;
    upscaledImagePath?: string;
    resultText?: string;
    colorVariants?: WorkflowStepColorVariant[];
  },
): Promise<void> {
  const col = stepCollection(workspaceId, workflowId);
  const snap = await col.where("index", "==", stepIndex).limit(1).get();
  if (snap.empty) {
    throw new Error(`Step at index ${stepIndex} not found`);
  }
  const update: Record<string, unknown> = {};
  if (data.status !== undefined) update.status = data.status;
  if (data.resultImagePath !== undefined)
    update.resultImagePath = data.resultImagePath;
  if (data.upscaledImagePath !== undefined)
    update.upscaledImagePath = data.upscaledImagePath;
  if (data.resultText !== undefined) update.resultText = data.resultText;
  if (data.colorVariants !== undefined)
    update.colorVariants = data.colorVariants;
  if (Object.keys(update).length === 0) {
    throw new Error("updateWorkflowStep: no fields to update");
  }
  await snap.docs[0].ref.update(update);
}

export async function softDeleteWorkflow(
  workspaceId: string,
  workflowId: string,
  deletedBy: string,
): Promise<void> {
  await workflowCollection(workspaceId).doc(workflowId).update({
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function restoreWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<void> {
  await workflowCollection(workspaceId).doc(workflowId).update({
    deletedAt: null,
    deletedBy: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function hardDeleteWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  const stepsSnap = await stepCollection(workspaceId, workflowId).get();
  for (const doc of stepsSnap.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(workflowCollection(workspaceId).doc(workflowId));
  await batch.commit();
}

export async function softDeleteStepImage(
  workspaceId: string,
  workflowId: string,
  stepIndex: number,
  deletedBy: string,
): Promise<void> {
  const col = stepCollection(workspaceId, workflowId);
  const snap = await col.where("index", "==", stepIndex).limit(1).get();
  if (snap.empty) throw new Error(`Step at index ${stepIndex} not found`);
  await snap.docs[0].ref.update({
    resultImageDeletedAt: FieldValue.serverTimestamp(),
    resultImageDeletedBy: deletedBy,
  });
}

export async function restoreStepImage(
  workspaceId: string,
  workflowId: string,
  stepIndex: number,
): Promise<void> {
  const col = stepCollection(workspaceId, workflowId);
  const snap = await col.where("index", "==", stepIndex).limit(1).get();
  if (snap.empty) throw new Error(`Step at index ${stepIndex} not found`);
  await snap.docs[0].ref.update({
    resultImageDeletedAt: null,
    resultImageDeletedBy: null,
  });
}

export async function replaceWorkflowStep(
  workspaceId: string,
  workflowId: string,
  stepIndex: number,
  step: Omit<CreateWorkflowStepInput, "index">,
): Promise<void> {
  const col = stepCollection(workspaceId, workflowId);
  const snap = await col.where("index", "==", stepIndex).limit(1).get();
  if (snap.empty) {
    throw new Error(`Step at index ${stepIndex} not found`);
  }

  const now = FieldValue.serverTimestamp();
  await snap.docs[0].ref.update({
    type: step.type,
    title: step.title,
    description: step.description,
    promptConfig: step.promptConfig,
    status: "planned" as const,
    createdAt: now,
  });
}
