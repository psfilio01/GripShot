import { getDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface GenerationPreferences {
  defaultAspectRatio?: string;
  defaultResolution?: string;
  defaultWorkflowType?: string;
}

export async function getPreferences(
  workspaceId: string,
): Promise<GenerationPreferences> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .get();

  const data = snap.data();
  return {
    defaultAspectRatio: data?.defaultAspectRatio,
    defaultResolution: data?.defaultResolution,
    defaultWorkflowType: data?.defaultWorkflowType,
  };
}

export async function updatePreferences(
  workspaceId: string,
  prefs: GenerationPreferences,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (prefs.defaultAspectRatio !== undefined) {
    update.defaultAspectRatio = prefs.defaultAspectRatio;
  }
  if (prefs.defaultResolution !== undefined) {
    update.defaultResolution = prefs.defaultResolution;
  }
  if (prefs.defaultWorkflowType !== undefined) {
    update.defaultWorkflowType = prefs.defaultWorkflowType;
  }

  await getDb().collection("workspaces").doc(workspaceId).update(update);
}
