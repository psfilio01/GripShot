import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const ALLOWED_ROOTS = ["generated", "products"];

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const dataRoot = getDataRoot();

  const rootSegment = segments[0];
  if (!ALLOWED_ROOTS.includes(rootSegment)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = join(dataRoot, ...segments);
  const normalizedPath = resolve(filePath);

  if (!normalizedPath.startsWith(resolve(dataRoot))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!existsSync(normalizedPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const buffer = await readFile(normalizedPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
