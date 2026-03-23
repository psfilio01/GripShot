import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

export type GenerationLogType =
  | "image"
  | "listing-copy"
  | "aplus"
  | "background"
  | "human-model";

export interface GenerationLogEntry {
  id?: string;
  type: GenerationLogType;
  workspaceId: string;
  userId: string;
  userEmail: string;

  /** Full prompt text sent to the model */
  prompt: string;
  /** Truncated preview (first 200 chars) for list views */
  promptPreview: string;

  /** Input parameters that generated this prompt */
  input: Record<string, unknown>;

  /** Model used (e.g. gemini-2.0-flash-exp) */
  model?: string;
  /** Reference image count for image generation */
  referenceImageCount?: number;
  /** Aspect ratio if applicable */
  aspectRatio?: string;
  /** Resolution if applicable */
  resolution?: string;

  /** Duration of the generation call in milliseconds */
  durationMs?: number;
  /** Status of the generation */
  status: "started" | "completed" | "failed";
  /** Error message if failed */
  errorMessage?: string;

  /** Timestamp (set by Firestore) */
  createdAt?: unknown;
}

const COLLECTION = "generationLogs";

export async function insertGenerationLog(
  entry: Omit<GenerationLogEntry, "id" | "promptPreview" | "createdAt">,
): Promise<string> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc();

  const doc: Record<string, unknown> = {
    ...entry,
    promptPreview: entry.prompt.slice(0, 200),
    createdAt: FieldValue.serverTimestamp(),
  };

  await ref.set(doc);
  return ref.id;
}

export async function updateGenerationLog(
  logId: string,
  update: Partial<Pick<GenerationLogEntry, "status" | "durationMs" | "errorMessage">>,
): Promise<void> {
  await getDb().collection(COLLECTION).doc(logId).update(update);
}

export interface GenerationLogQuery {
  limit?: number;
  type?: GenerationLogType;
  startAfter?: string;
}

export interface StoredGenerationLog extends GenerationLogEntry {
  id: string;
  createdAt: { _seconds: number; _nanoseconds: number } | null;
}

export async function listGenerationLogs(
  query: GenerationLogQuery = {},
): Promise<StoredGenerationLog[]> {
  const db = getDb();
  let q = db
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(query.limit ?? 50);

  if (query.type) {
    q = q.where("type", "==", query.type);
  }

  if (query.startAfter) {
    const cursorSnap = await db.collection(COLLECTION).doc(query.startAfter).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }

  const snap = await q.get();
  return snap.docs.map((doc) => ({
    ...(doc.data() as GenerationLogEntry),
    id: doc.id,
    createdAt: doc.data().createdAt ?? null,
  })) as StoredGenerationLog[];
}

export async function getGenerationLog(
  logId: string,
): Promise<StoredGenerationLog | null> {
  const snap = await getDb().collection(COLLECTION).doc(logId).get();
  if (!snap.exists) return null;
  return {
    ...(snap.data() as GenerationLogEntry),
    id: snap.id,
    createdAt: snap.data()!.createdAt ?? null,
  } as StoredGenerationLog;
}
