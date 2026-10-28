import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getHumanModel } from "@/lib/db/human-models";
import { config } from "dotenv";
import { resolve, join, extname } from "path";
import { mkdir, readdir, stat, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { getSingleImageUpload, imageUploadFileName, ImageUploadError, readImageUploadFormData, validateImageUpload } from "@/lib/images/upload-validation";
import {
  usesGcsBlobStorage,
  putDataObject,
  deleteDataObject,
  getDataObjectBuffer,
  getDataObjectMeta,
  listDataObjectKeys,
} from "@fashionmentum/workflow-core";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function refDirFor(modelId: string): string {
  return join(getDataRoot(), "models", modelId, "reference");
}

function gcsRefPrefix(modelId: string): string {
  return `models/${modelId}/reference/`;
}

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

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

  try {
    const images: {
      name: string;
      url: string;
      size: number;
      updatedAt: string;
    }[] = [];

    if (usesGcsBlobStorage()) {
      const keys = await listDataObjectKeys(gcsRefPrefix(modelId));
      for (const key of keys) {
        const base = key.split("/").pop() ?? "";
        if (base.startsWith(".")) continue;
        const ext = extname(base).toLowerCase();
        if (!IMAGE_EXT.includes(ext)) continue;
        const meta = await getDataObjectMeta(key);
        if (!meta) continue;
        images.push({
          name: base,
          url: `/api/images/models/${modelId}/reference/${encodeURIComponent(base)}`,
          size: meta.size,
          updatedAt: meta.updated.toISOString(),
        });
      }
      return NextResponse.json({ images });
    }

    const dir = refDirFor(modelId);
    const files = await readdir(dir);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (IMAGE_EXT.includes(ext)) {
        const st = await stat(join(dir, file));
        images.push({
          name: file,
          url: `/api/images/models/${modelId}/reference/${encodeURIComponent(file)}`,
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
    const formData = await readImageUploadFormData(req);
    const entry = getSingleImageUpload(formData, "files");
    const { buffer, imageType } = await validateImageUpload(entry);
    const safeName = imageUploadFileName(entry.name, imageType.extension);
    if (usesGcsBlobStorage()) {
      await putDataObject(`${gcsRefPrefix(modelId)}${safeName}`, buffer, imageType.contentType);
    } else {
      const dir = refDirFor(modelId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, safeName), buffer);
    }
    const uploaded = [safeName];
    return NextResponse.json({ uploaded, count: uploaded.length });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
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

  if (usesGcsBlobStorage()) {
    const key = `${gcsRefPrefix(modelId)}${fileName}`;
    const buf = await getDataObjectBuffer(key);
    if (!buf) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    await deleteDataObject(key);
    return NextResponse.json({ deleted: fileName });
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
