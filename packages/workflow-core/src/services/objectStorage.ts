import { Storage } from "@google-cloud/storage";
import fs from "fs-extra";
import path from "node:path";
import { getEnv } from "../config/env";

let storageClient: Storage | null = null;

function bucketName(): string | undefined {
  const raw = getEnv().WORKFLOW_GCS_BUCKET?.trim();
  return raw || undefined;
}

export function usesGcsBlobStorage(): boolean {
  return !!bucketName();
}

export function getWorkflowGcsBucketName(): string | undefined {
  return bucketName();
}

/**
 * If `err` is a typical GCS bucket misconfiguration, returns an operator-facing hint; otherwise null.
 */
export function formatWorkflowStorageError(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const looksLikeBucket =
    lower.includes("specified bucket does not exist") ||
    lower.includes("bucket does not exist") ||
    lower.includes("bucket not found") ||
    lower.includes("no such bucket");
  if (!looksLikeBucket) return null;

  const b = bucketName() ?? "(WORKFLOW_GCS_BUCKET)";
  return (
    `Google Cloud Storage bucket "${b}" does not exist or is not visible to Application Default Credentials. ` +
    `Create it in the correct GCP project (Cloud Console → Storage, or gsutil mb gs://${b}), ` +
    `set WORKFLOW_GCS_BUCKET to the exact bucket name (often PROJECT_ID.appspot.com for Firebase default), ` +
    `or unset WORKFLOW_GCS_BUCKET to use the local data folder only.`
  );
}

function getBucket() {
  const name = bucketName();
  if (!name) {
    throw new Error("WORKFLOW_GCS_BUCKET is not configured");
  }
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient.bucket(name);
}

export async function putDataObject(
  key: string,
  buffer: Buffer,
  contentType?: string,
): Promise<void> {
  const file = getBucket().file(key);
  await file.save(buffer, {
    resumable: false,
    metadata: contentType ? { contentType } : undefined,
  });
}

export async function getDataObjectBuffer(key: string): Promise<Buffer | null> {
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return buf;
}

export async function dataObjectExists(key: string): Promise<boolean> {
  const [exists] = await getBucket().file(key).exists();
  return exists;
}

export async function deleteDataObject(key: string): Promise<void> {
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (exists) await file.delete({ ignoreNotFound: true });
}

export async function deleteDataObjectsWithPrefix(prefix: string): Promise<void> {
  const keys = await listDataObjectKeys(prefix);
  await Promise.all(keys.map((k) => deleteDataObject(k)));
}

export async function copyDataObject(srcKey: string, destKey: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(srcKey).copy(bucket.file(destKey));
}

export async function listDataObjectKeys(prefix: string): Promise<string[]> {
  const [files] = await getBucket().getFiles({ prefix });
  return files.map((f) => f.name);
}

export async function getDataObjectMeta(key: string): Promise<{
  size: number;
  updated: Date;
} | null> {
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [meta] = await file.getMetadata();
  const size = Number(meta.size ?? 0);
  const updatedRaw = meta.updated;
  const updated =
    typeof updatedRaw === "string" ? new Date(updatedRaw) : new Date();
  return { size, updated };
}

/**
 * Read bytes for a path produced by loaders or stored variants.
 * - Absolute paths → local file (existing behaviour).
 * - Relative keys (e.g. `generated/...`) → GCS when WORKFLOW_GCS_BUCKET is set, else `<WORKFLOW_DATA_ROOT>/<key>`.
 */
export async function readWorkflowDataFile(imagePath: string): Promise<Buffer> {
  if (path.isAbsolute(imagePath)) {
    return fs.readFile(imagePath);
  }

  if (usesGcsBlobStorage()) {
    const fromGcs = await getDataObjectBuffer(imagePath);
    if (fromGcs) return fromGcs;
  }

  const root = getEnv().WORKFLOW_DATA_ROOT;
  return fs.readFile(path.join(root, imagePath));
}
