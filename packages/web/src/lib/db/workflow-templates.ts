import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type {
  WorkflowTemplateDoc,
  WorkflowTemplateStep,
  WorkflowGlobalSettings,
} from "./types";

function templateCollection(workspaceId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("workflowTemplates");
}

export async function createWorkflowTemplate(
  workspaceId: string,
  input: {
    name: string;
    description: string;
    globalSettings: WorkflowGlobalSettings;
    steps: WorkflowTemplateStep[];
  },
): Promise<string> {
  const ref = templateCollection(workspaceId).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    name: input.name.trim(),
    description: input.description.trim(),
    globalSettings: input.globalSettings,
    steps: input.steps,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listWorkflowTemplates(
  workspaceId: string,
): Promise<(WorkflowTemplateDoc & { id: string })[]> {
  const snap = await templateCollection(workspaceId)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as WorkflowTemplateDoc),
  }));
}

export async function getWorkflowTemplate(
  workspaceId: string,
  templateId: string,
): Promise<(WorkflowTemplateDoc & { id: string }) | null> {
  const snap = await templateCollection(workspaceId).doc(templateId).get();
  return snap.exists
    ? { id: snap.id, ...(snap.data() as WorkflowTemplateDoc) }
    : null;
}
