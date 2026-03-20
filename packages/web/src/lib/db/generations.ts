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
  let query = getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("generations")
    .orderBy("createdAt", "desc")
    .limit(limit) as FirebaseFirestore.Query;

  if (type) {
    query = query.where("type", "==", type);
  }

  const snap = await query.get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as GenerationRecord,
  );
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
