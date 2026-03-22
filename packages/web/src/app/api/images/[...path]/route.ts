import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { join, extname, resolve, sep } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const ALLOWED_ROOTS = ["generated", "products", "models"];

function getPrimaryDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

/**
 * Try primary root (env / monorepo data), then `packages/web/data` where older
 * jobs may have written files when workflow-core defaulted to cwd + "/data".
 */
function candidateDataRoots(): string[] {
  const primary = resolve(getPrimaryDataRoot());
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

/** Safe segment for job id / bucket / file name (no traversal). */
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

const ALL_BUCKETS = ["neutral", "favorites", "rejected", "variants"];

/**
 * Legacy layouts used human-readable folder names (e.g. "Pilates Mini Ball")
 * while Firestore uses ids (e.g. "pilates-mini-ball"). If the exact path
 * misses, locate `generated/<any>/<jobId>/<bucket>/<file>` under the same data root.
 *
 * Also tries alternate buckets because feedback moves files between
 * neutral/favorites/rejected while metadata may still reference the old bucket.
 */
function findGeneratedByJobPath(
  segments: string[],
  dataRoot: string,
): string | null {
  if (segments[0] !== "generated" || segments.length !== 5) {
    return null;
  }
  const [, _productSegment, jobId, bucket, fileName] = segments;
  if (
    !SAFE_SEGMENT.test(jobId) ||
    !SAFE_SEGMENT.test(bucket) ||
    !SAFE_SEGMENT.test(fileName)
  ) {
    return null;
  }

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

  const bucketsToTry = [bucket, ...ALL_BUCKETS.filter((b) => b !== bucket)];

  for (const productDir of subdirs) {
    if (/[/\\]/.test(productDir)) continue;
    for (const tryBucket of bucketsToTry) {
      const candidate = resolve(join(genRoot, productDir, jobId, tryBucket, fileName));
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

  const rootSegment = segments[0];
  if (!ALLOWED_ROOTS.includes(rootSegment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let resolvedFile: string | null = null;

  for (const dataRoot of candidateDataRoots()) {
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

  // For generated images: try alternate buckets at exact product path
  // (files move between neutral/favorites/rejected on feedback)
  if (
    !resolvedFile &&
    segments[0] === "generated" &&
    segments.length === 5
  ) {
    const [, productId, jobId, bucket, fileName] = segments;
    if (
      SAFE_SEGMENT.test(jobId) &&
      SAFE_SEGMENT.test(bucket) &&
      SAFE_SEGMENT.test(fileName)
    ) {
      const altBuckets = ALL_BUCKETS.filter((b) => b !== bucket);
      for (const dataRoot of candidateDataRoots()) {
        for (const altBucket of altBuckets) {
          const altPath = resolve(
            join(dataRoot, "generated", productId, jobId, altBucket, fileName),
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
  }

  // Fallback: scan all product directories for the jobId/bucket/file combo
  if (!resolvedFile && segments[0] === "generated") {
    for (const dataRoot of candidateDataRoots()) {
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
