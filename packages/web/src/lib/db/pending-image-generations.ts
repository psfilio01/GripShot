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
  /** Hero master whose color expansion is represented by this row. */
  heroMasterImageId?: string;
  status: "running" | "failed" | "cancelled";
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
    | "heroMasterImageId"
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
  if (data.heroMasterImageId != null) {
    payload.heroMasterImageId = data.heroMasterImageId;
  }
  await collectionRef(workspaceId).doc(requestId).set(payload);
}

export async function deletePendingImageGeneration(
  workspaceId: string,
  requestId: string,
): Promise<void> {
  await collectionRef(workspaceId).doc(requestId).delete();
}

/** Clears stale "failed" placeholders so a new run is not shown next to fresh results. */
export async function deleteFailedPendingImageGenerationsForProduct(
  workspaceId: string,
  productId: string,
): Promise<void> {
  const snap = await collectionRef(workspaceId)
    .where("productId", "==", productId)
    .get();
  const batch = getDb().batch();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as PendingImageGenerationDoc;
    if (d.status === "failed") {
      batch.delete(doc.ref);
      n++;
    }
  }
  if (n > 0) {
    await batch.commit();
  }
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

export async function cancelPendingImageGeneration(
  workspaceId: string,
  requestId: string,
): Promise<"cancelled" | "already_cancelled" | "not_found" | "not_running"> {
  const ref = collectionRef(workspaceId).doc(requestId);
  return getDb().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return "not_found";
    const data = snap.data() as PendingImageGenerationDoc;
    if (data.status === "cancelled") return "already_cancelled";
    if (data.status !== "running") return "not_running";
    transaction.update(ref, {
      status: "cancelled" as const,
      completedAt: FieldValue.serverTimestamp(),
    });
    return "cancelled";
  });
}

export async function isPendingImageGenerationCancelled(
  workspaceId: string,
  requestId: string,
): Promise<boolean> {
  const snap = await collectionRef(workspaceId).doc(requestId).get();
  return snap.exists &&
    (snap.data() as PendingImageGenerationDoc).status === "cancelled";
}

export async function cancelPendingHeroGenerationsForMaster(
  workspaceId: string,
  heroMasterImageId: string,
): Promise<string[]> {
  const snap = await collectionRef(workspaceId)
    .where("heroMasterImageId", "==", heroMasterImageId)
    .get();
  const requestIds: string[] = [];
  const batch = getDb().batch();
  for (const doc of snap.docs) {
    const data = doc.data() as PendingImageGenerationDoc;
    if (data.status !== "running") continue;
    requestIds.push(doc.id);
    batch.update(doc.ref, {
      status: "cancelled" as const,
      completedAt: FieldValue.serverTimestamp(),
    });
  }
  if (requestIds.length > 0) await batch.commit();
  return requestIds;
}

export interface PendingImageGenerationListItem {
  requestId: string;
  productId: string;
  workflowType: string;
  aspectRatio?: string;
  resolution?: string;
  kind?: "hero";
  expectedVariantCount?: number;
  heroMasterImageId?: string;
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

    if (d.status === "cancelled") {
      const completedMs = d.completedAt?.toMillis?.() ?? startedMs;
      if (now - completedMs > FAILED_TTL_MS) {
        batch.delete(doc.ref);
        batchCount++;
        if (batchCount >= 400) await flushBatch();
      }
      continue;
    }

    out.push({
      requestId: doc.id,
      productId: d.productId,
      workflowType: d.workflowType,
      aspectRatio: d.aspectRatio,
      resolution: d.resolution,
      kind: d.kind,
      expectedVariantCount: d.expectedVariantCount,
      heroMasterImageId: d.heroMasterImageId,
      status: d.status,
      startedAt: new Date(startedMs || now).toISOString(),
      errorMessage: d.errorMessage,
    });
  }

  await flushBatch();
  return out;
}
