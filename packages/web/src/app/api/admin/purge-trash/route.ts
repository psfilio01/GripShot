import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { isAdminUid } from "@/lib/auth/admin";
import { getDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  usesGcsBlobStorage,
  deleteDataObjectsWithPrefix,
} from "@fashionmentum/workflow-core";
import { resolve, join } from "path";
import { rm } from "fs/promises";
import { existsSync } from "fs";

const TRASH_TTL_DAYS = 7;

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

/** Purge all soft-deleted items older than TRASH_TTL_DAYS days. */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const schedulerSecret = process.env.PURGE_TRASH_SECRET;

  let authorized = false;

  if (schedulerSecret && authHeader === `Bearer ${schedulerSecret}`) {
    authorized = true;
  } else {
    const session = await getServerSession();
    if (session && isAdminUid(session.user.uid)) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const cutoff = Timestamp.fromMillis(
    Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const collections: Array<{ sub: string; storagePrefix: string | null; localDir: string | null }> = [
    { sub: "products", storagePrefix: null, localDir: null },
    { sub: "humanModels", storagePrefix: "models", localDir: "models" },
    { sub: "backgrounds", storagePrefix: "backgrounds", localDir: "backgrounds" },
    { sub: "workflows", storagePrefix: null, localDir: null },
  ];

  let totalPurged = 0;

  const workspacesSnap = await db.collection("workspaces").get();

  for (const ws of workspacesSnap.docs) {
    const wid = ws.id;

    for (const { sub, storagePrefix, localDir } of collections) {
      const snap = await db
        .collection("workspaces")
        .doc(wid)
        .collection(sub)
        .where("deletedAt", "!=", null)
        .where("deletedAt", "<=", cutoff)
        .get();

      const batch = db.batch();
      for (const doc of snap.docs) {
        const docId = doc.id;

        if (storagePrefix) {
          try {
            if (usesGcsBlobStorage()) {
              await deleteDataObjectsWithPrefix(`${storagePrefix}/${docId}/`);
            } else {
              const dir = join(getDataRoot(), localDir!, docId);
              if (existsSync(dir)) {
                await rm(dir, { recursive: true, force: true });
              }
            }
          } catch {
            /* storage cleanup is best-effort */
          }
        }

        if (sub === "workflows") {
          const stepsSnap = await doc.ref.collection("steps").get();
          for (const step of stepsSnap.docs) {
            batch.delete(step.ref);
          }
        }

        batch.delete(doc.ref);
        totalPurged++;
      }

      if (snap.docs.length > 0) {
        await batch.commit();
      }
    }
  }

  return NextResponse.json({ purged: totalPurged, cutoff: cutoff.toDate().toISOString() });
}
