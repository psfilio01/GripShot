import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getHumanModel } from "@/lib/db/human-models";
import { config } from "dotenv";
import { resolve, join, extname } from "path";
import { mkdir, readdir, stat, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";

config({ path: resolve(process.cwd(), "../../.env") });

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function refDirFor(modelId: string): string {
  return join(getDataRoot(), "models", modelId, "reference");
}

type Params = { params: Promise<{ modelId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { modelId } = await params;
  const model = await getHumanModel(session.user.workspaceId, modelId);
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const dir = refDirFor(modelId);
  try {
    const files = await readdir(dir);
    const images = [];
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
        const st = await stat(join(dir, file));
        images.push({
          name: file,
          url: `/api/images/models/${modelId}/reference/${file}`,
          size: st.size,
          updatedAt: st.mtime.toISOString(),
        });
      }
    }
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { modelId } = await params;
  const model = await getHumanModel(session.user.workspaceId, modelId);
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files");
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 },
      );
    }

    const dir = refDirFor(modelId);
    await mkdir(dir, { recursive: true });
    const uploaded: string[] = [];

    for (const entry of files) {
      if (!(entry instanceof File)) continue;
      if (!ALLOWED_TYPES.has(entry.type)) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${entry.type}. Use JPEG, PNG, or WebP.`,
          },
          { status: 400 },
        );
      }
      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${entry.name} exceeds 10 MB limit.` },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      await writeFile(join(dir, safeName), buffer);
      uploaded.push(safeName);
    }

    return NextResponse.json({ uploaded, count: uploaded.length });
  } catch (err) {
    console.error("Model reference upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { modelId } = await params;
  const model = await getHumanModel(session.user.workspaceId, modelId);
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("name");
  if (!fileName || /[/\\]/.test(fileName)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const dir = refDirFor(modelId);
  const filePath = join(dir, fileName);
  const normalizedPath = resolve(filePath);
  const safeBoundary = resolve(dir);
  if (!normalizedPath.startsWith(safeBoundary)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!existsSync(normalizedPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await unlink(normalizedPath);
  return NextResponse.json({ deleted: fileName });
}
