import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

const SUBCOLLECTION = "pendingImageGenerations";

/** Max age (ms) for stuck "running" rows — cleaned up when listing jobs */
const STALE_RUNNING_MS = 45 * 60 * 1000;

/** Drop failed placeholders from API after this long (client may still see briefly) */
const FAILED_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingImageGenerationDoc {
  productId: string;
  workflowType: string;
  aspectRatio?: string;
  resolution?: string;
  /** Set when pending row is for Hero color-variant pipeline (not standard Generate). */
  kind?: "hero";
  /** Configured product colors count (upper bound; some may be skipped after scene analysis). */
  expectedVariantCount?: number;
  status: "running" | "failed";
  startedAt: FirebaseFirestore.Timestamp;
  errorMessage?: string;
}

function collectionRef(workspaceId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection(SUBCOLLECTION);
}

export async function createPendingImageGeneration(
  workspaceId: string,
  requestId: string,
  data: Pick<
    PendingImageGenerationDoc,
    | "productId"
    | "workflowType"
    | "aspectRatio"
    | "resolution"
    | "kind"
    | "expectedVariantCount"
  >,
): Promise<void> {
  const payload: Record<string, unknown> = {
    productId: data.productId,
    workflowType: data.workflowType,
    status: "running" as const,
    startedAt: FieldValue.serverTimestamp(),
  };
  if (data.aspectRatio != null) payload.aspectRatio = data.aspectRatio;
  if (data.resolution != null) payload.resolution = data.resolution;
  if (data.kind != null) payload.kind = data.kind;
  if (data.expectedVariantCount != null) {
    payload.expectedVariantCount = data.expectedVariantCount;
  }
  await collectionRef(workspaceId).doc(requestId).set(payload);
}

export async function deletePendingImageGeneration(
  workspaceId: string,
  requestId: string,
): Promise<void> {
  await collectionRef(workspaceId).doc(requestId).delete();
}

export async function failPendingImageGeneration(
  workspaceId: string,
  requestId: string,
  errorMessage: string,
): Promise<void> {
  await collectionRef(workspaceId).doc(requestId).update({
    status: "failed" as const,
    errorMessage,
    completedAt: FieldValue.serverTimestamp(),
  });
}

export interface PendingImageGenerationListItem {
  requestId: string;
  productId: string;
  workflowType: string;
  aspectRatio?: string;
  resolution?: string;
  kind?: "hero";
  expectedVariantCount?: number;
  status: "running" | "failed";
  startedAt: string;
  errorMessage?: string;
}

/**
 * Lists recent pending/failed image generations for the workspace.
 * Removes stale "running" and old "failed" documents opportunistically.
 */
export async function listAndPrunePendingImageGenerations(
  workspaceId: string,
  limit = 30,
): Promise<PendingImageGenerationListItem[]> {
  const ref = collectionRef(workspaceId);
  const snap = await ref.orderBy("startedAt", "desc").limit(limit).get();
  const now = Date.now();
  const out: PendingImageGenerationListItem[] = [];
  let batch = getDb().batch();
  let batchCount = 0;

  const flushBatch = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = getDb().batch();
    batchCount = 0;
  };

  for (const doc of snap.docs) {
    const d = doc.data() as PendingImageGenerationDoc & {
      completedAt?: FirebaseFirestore.Timestamp;
    };
    const startedMs = d.startedAt?.toMillis?.() ?? 0;
    const age = now - startedMs;

    if (d.status === "running" && age > STALE_RUNNING_MS) {
      batch.delete(doc.ref);
      batchCount++;
      if (batchCount >= 400) await flushBatch();
      continue;
    }

    if (d.status === "failed") {
      const completedMs = d.completedAt?.toMillis?.() ?? startedMs;
      if (now - completedMs > FAILED_TTL_MS) {
        batch.delete(doc.ref);
        batchCount++;
        if (batchCount >= 400) await flushBatch();
        continue;
      }
    }

    out.push({
      requestId: doc.id,
      productId: d.productId,
      workflowType: d.workflowType,
      aspectRatio: d.aspectRatio,
      resolution: d.resolution,
      kind: d.kind,
      expectedVariantCount: d.expectedVariantCount,
      status: d.status,
      startedAt: new Date(startedMs || now).toISOString(),
      errorMessage: d.errorMessage,
    });
  }

  await flushBatch();
  return out;
}
