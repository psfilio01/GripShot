import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

export interface GenerationRecord {
  id: string;
  type: "listing-copy" | "aplus";
  productId: string;
  productName: string;
  moduleId?: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
}

export async function saveGeneration(
  workspaceId: string,
  data: Omit<GenerationRecord, "id" | "createdAt">,
): Promise<string> {
  const ref = getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("generations")
    .doc();

  await ref.set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

export async function listGenerations(
  workspaceId: string,
  type?: "listing-copy" | "aplus",
  limit = 20,
): Promise<GenerationRecord[]> {
  const base = getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("generations");

  let query: FirebaseFirestore.Query = type
    ? base.where("type", "==", type).orderBy("createdAt", "desc").limit(limit)
    : base.orderBy("createdAt", "desc").limit(limit);

  try {
    const snap = await query.get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as GenerationRecord,
    );
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 9 && type) {
      console.warn(
        "Composite index missing for generations (type + createdAt). " +
          "Falling back to unfiltered query. Create the index via the link in the error above.",
      );
      const fallback = await base.orderBy("createdAt", "desc").limit(limit * 2).get();
      return fallback.docs
        .map((d) => ({ id: d.id, ...d.data() }) as GenerationRecord)
        .filter((r) => r.type === type)
        .slice(0, limit);
    }
    throw err;
  }
}

export async function getGeneration(
  workspaceId: string,
  generationId: string,
): Promise<GenerationRecord | null> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("generations")
    .doc(generationId)
    .get();

  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as GenerationRecord)
    : null;
}
