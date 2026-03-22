import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
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
