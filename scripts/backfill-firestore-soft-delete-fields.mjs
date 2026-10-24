#!/usr/bin/env node
/**
 * One-time backfill: set deletedAt / deletedBy to null on documents that omit them,
 * so list queries using where("deletedAt", "==", null) return those rows.
 *
 * Run from repo root:
 *   ./scripts/backfill-soft-delete-fields.sh
 *   ./scripts/backfill-soft-delete-fields.sh --dry-run
 *   ./scripts/backfill-soft-delete-fields.sh --dry-run --verbose
 *   ./scripts/backfill-soft-delete-fields.sh --workspace=<workspaceId>
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 * (same as the Next.js app — typically root .env and/or packages/web/.env.local).
 */

import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const require = createRequire(path.join(ROOT, "packages", "web", "package.json"));
const dotenv = require("dotenv");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

for (const p of [
  path.join(ROOT, ".env"),
  path.join(ROOT, ".env.local"),
  path.join(ROOT, "packages", "web", ".env.local"),
]) {
  if (existsSync(p)) dotenv.config({ path: p, override: true });
}

const SUBCOLLECTIONS = ["humanModels", "products", "backgrounds", "workflows"];

function parseArgs(argv) {
  let dryRun = false;
  let verbose = false;
  let workspaceId = null;
  for (const a of argv) {
    if (a === "--dry-run" || a === "-n") dryRun = true;
    else if (a === "--verbose" || a === "-v") verbose = true;
    else if (a.startsWith("--workspace="))
      workspaceId = a.slice("--workspace=".length).trim() || null;
  }
  return { dryRun, verbose, workspaceId };
}

function initAdmin() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  privateKey = privateKey?.replace(/^["']|["']$/g, "").trim();

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY",
    );
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

function isTimestamp(v) {
  return (
    v != null &&
    typeof v === "object" &&
    typeof v.toDate === "function" &&
    typeof v.toMillis === "function"
  );
}

/** Document needs patch if deletedAt is missing, or active doc is missing deletedBy. */
function needsPatch(data) {
  if (data == null) return false;
  if (isTimestamp(data.deletedAt)) return false;
  if (data.deletedAt === undefined) return true;
  if (data.deletedAt === null && data.deletedBy === undefined) return true;
  return false;
}

function patchPayload(data) {
  const out = {};
  if (data.deletedAt === undefined) {
    out.deletedAt = null;
    out.deletedBy = null;
  } else if (data.deletedAt === null && data.deletedBy === undefined) {
    out.deletedBy = null;
  }
  out.updatedAt = FieldValue.serverTimestamp();
  return out;
}

async function run() {
  const { dryRun, verbose, workspaceId: onlyWorkspace } = parseArgs(
    process.argv.slice(2),
  );
  const db = initAdmin();

  const workspacesSnap = onlyWorkspace
    ? await db.collection("workspaces").doc(onlyWorkspace).get()
    : await db.collection("workspaces").get();

  const workspaceDocs = onlyWorkspace
    ? workspacesSnap.exists
      ? [{ id: workspacesSnap.id, ref: workspacesSnap.ref }]
      : []
    : workspacesSnap.docs.map((d) => ({ id: d.id, ref: d.ref }));

  if (onlyWorkspace && workspaceDocs.length === 0) {
    console.error(`Workspace not found: ${onlyWorkspace}`);
    process.exit(1);
  }

  let examined = 0;
  let wouldPatch = 0;
  let patched = 0;

  for (const { id: wsId, ref: wsRef } of workspaceDocs) {
    for (const sub of SUBCOLLECTIONS) {
      const col = wsRef.collection(sub);
      const snap = await col.get();
      let batch = db.batch();
      let batchCount = 0;

      const flush = async () => {
        if (batchCount === 0) return;
        if (!dryRun) await batch.commit();
        batch = db.batch();
        batchCount = 0;
      };

      for (const doc of snap.docs) {
        examined++;
        const data = doc.data();
        if (!needsPatch(data)) continue;
        wouldPatch++;
        const payload = patchPayload(data);

        if (dryRun) {
          if (verbose) {
            console.log(
              `[dry-run] ${sub} workspaces/${wsId}/${sub}/${doc.id} -> ${JSON.stringify({ ...payload, updatedAt: "<serverTimestamp>" })}`,
            );
          }
          continue;
        }

        batch.update(doc.ref, payload);
        batchCount++;
        patched++;
        if (batchCount >= 400) await flush();
      }
      await flush();
    }
  }

  console.log(
    dryRun
      ? `Done (dry-run). Examined ${examined} documents, ${wouldPatch} would be updated.`
      : `Done. Examined ${examined} documents, updated ${patched} documents.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
