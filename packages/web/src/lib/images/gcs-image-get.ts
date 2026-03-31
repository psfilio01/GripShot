import { extname } from "path";
import {
  getDataObjectBuffer,
  listDataObjectKeys,
  usesGcsBlobStorage,
} from "@fashionmentum/workflow-core";
import { GENERATED_BUCKETS, parseGeneratedTrailing } from "./generated-request-path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeForFileName(name: string): string {
  const ext = extname(name).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Resolve image bytes from GCS when WORKFLOW_GCS_BUCKET is set (same key layout as under WORKFLOW_DATA_ROOT).
 */
export async function tryServeImageFromGcs(
  segments: string[],
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!usesGcsBlobStorage()) return null;

  const leaf = segments[segments.length - 1] ?? "file";
  const primaryKey = segments.join("/");
  let buffer = await getDataObjectBuffer(primaryKey);
  if (buffer) {
    return { buffer, contentType: mimeForFileName(leaf) };
  }

  const trailing = parseGeneratedTrailing(segments);
  if (trailing && segments[0] === "generated") {
    const productSegments = segments.slice(1, -3);
    const { jobId, bucket, fileName } = trailing;
    const bucketsToTry = [
      bucket,
      ...GENERATED_BUCKETS.filter((b) => b !== bucket),
    ];
    for (const b of bucketsToTry) {
      const altKey = ["generated", ...productSegments, jobId, b, fileName].join(
        "/",
      );
      buffer = await getDataObjectBuffer(altKey);
      if (buffer) {
        return { buffer, contentType: mimeForFileName(fileName) };
      }
    }

    const keys = await listDataObjectKeys("generated/");
    for (const k of keys) {
      if (!k.endsWith(`/${fileName}`)) continue;
      const parts = k.split("/");
      const jIdx = parts.indexOf(jobId);
      if (jIdx === -1 || jIdx + 1 >= parts.length) continue;
      const bucketSeg = parts[jIdx + 1];
      if (
        !(GENERATED_BUCKETS as readonly string[]).includes(bucketSeg ?? "")
      ) {
        continue;
      }
      buffer = await getDataObjectBuffer(k);
      if (buffer) {
        return { buffer, contentType: mimeForFileName(fileName) };
      }
    }
  }

  return null;
}
