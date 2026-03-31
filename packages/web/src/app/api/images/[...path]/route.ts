import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { join, extname, resolve, sep } from "path";
import { config } from "dotenv";
import {
  GENERATED_BUCKETS,
  parseGeneratedTrailing,
} from "@/lib/images/generated-request-path";
import { tryServeImageFromGcs } from "@/lib/images/gcs-image-get";

config({ path: resolve(process.cwd(), "../../.env") });

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const ALLOWED_ROOTS = ["generated", "products", "models", "backgrounds"];

function fallbackPrimaryDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

/**
 * Same order workflow-core uses, plus `packages/web/data` for legacy writes.
 * Dynamic-import workflow-core inside GET so `.env` is loaded before `getEnv()`.
 */
function candidateDataRoots(workflowCoreRoot: string): string[] {
  const primary = resolve(workflowCoreRoot);
  const cwd = process.cwd();
  const webLocal = resolve(cwd, "data");
  const ordered = [primary, webLocal];
  const seen = new Set<string>();
  return ordered.filter((r) => {
    const key = r.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPathInsideRoot(filePath: string, root: string): boolean {
  const normalizedFile = resolve(filePath);
  const normalizedRoot = resolve(root);
  const prefix =
    normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep;
  return (
    normalizedFile === normalizedRoot || normalizedFile.startsWith(prefix)
  );
}

/**
 * If exact path misses, locate `generated/<any>/<jobId>/<bucket>/<file>` under the data root.
 * Tries alternate buckets because feedback moves files between neutral/favorites/rejected.
 */
function findGeneratedByJobPath(
  segments: string[],
  dataRoot: string,
): string | null {
  const parsed = parseGeneratedTrailing(segments);
  if (!parsed) return null;

  const { jobId, bucket, fileName } = parsed;

  const genRoot = join(dataRoot, "generated");
  if (!existsSync(genRoot)) {
    return null;
  }

  let subdirs: string[];
  try {
    subdirs = readdirSync(genRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => !name.startsWith("."));
  } catch {
    return null;
  }

  const bucketsToTry = [bucket, ...GENERATED_BUCKETS.filter((b) => b !== bucket)];

  for (const productDir of subdirs) {
    if (/[/\\]/.test(productDir)) continue;
    for (const tryBucket of bucketsToTry) {
      const candidate = resolve(
        join(genRoot, productDir, jobId, tryBucket, fileName),
      );
      if (!isPathInsideRoot(candidate, genRoot)) continue;
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  let workflowCoreRoot: string;
  try {
    const { getWorkflowDataRoot } = await import("@fashionmentum/workflow-core");
    workflowCoreRoot = getWorkflowDataRoot();
  } catch {
    workflowCoreRoot = fallbackPrimaryDataRoot();
  }
  const roots = candidateDataRoots(workflowCoreRoot);

  const rootSegment = segments[0];
  if (!ALLOWED_ROOTS.includes(rootSegment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gcsHit = await tryServeImageFromGcs(segments);
  if (gcsHit) {
    const headers: Record<string, string> = {
      "Content-Type": gcsHit.contentType,
      "Cache-Control": "public, max-age=86400",
    };
    if (_req.nextUrl.searchParams.get("download") === "1") {
      const fileName = segments[segments.length - 1] ?? "image";
      headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
    }
    return new NextResponse(new Uint8Array(gcsHit.buffer), { headers });
  }

  let resolvedFile: string | null = null;

  for (const dataRoot of roots) {
    const filePath = join(dataRoot, ...segments);
    const normalizedPath = resolve(filePath);
    if (!isPathInsideRoot(normalizedPath, dataRoot)) {
      continue;
    }
    if (existsSync(normalizedPath)) {
      resolvedFile = normalizedPath;
      break;
    }
  }

  const trailing = parseGeneratedTrailing(segments);

  // Alternate buckets at the path implied by segments (single- or multi-segment product dir)
  if (!resolvedFile && trailing && segments[0] === "generated") {
    const productSegments = segments.slice(1, -3);
    const { jobId, bucket, fileName } = trailing;
    const altBuckets = GENERATED_BUCKETS.filter((b) => b !== bucket);
    for (const dataRoot of roots) {
      for (const altBucket of altBuckets) {
        const altPath = resolve(
          join(dataRoot, "generated", ...productSegments, jobId, altBucket, fileName),
        );
        if (!isPathInsideRoot(altPath, dataRoot)) continue;
        if (existsSync(altPath)) {
          resolvedFile = altPath;
          break;
        }
      }
      if (resolvedFile) break;
    }
  }

  if (!resolvedFile && segments[0] === "generated") {
    for (const dataRoot of roots) {
      const found = findGeneratedByJobPath(segments, dataRoot);
      if (found) {
        resolvedFile = found;
        break;
      }
    }
  }

  if (!resolvedFile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = extname(resolvedFile).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const buffer = await readFile(resolvedFile);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
  };

  if (_req.nextUrl.searchParams.get("download") === "1") {
    const fileName = segments[segments.length - 1] ?? "image";
    headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
  }

  return new NextResponse(buffer, { headers });
}
