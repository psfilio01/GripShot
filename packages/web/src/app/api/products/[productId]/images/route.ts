import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { config } from "dotenv";
import { resolve, join, extname } from "path";
import { mkdir, readdir, stat, writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import {
  usesGcsBlobStorage,
  putDataObject,
  getDataObjectBuffer,
  getDataObjectMeta,
  deleteDataObject,
  listDataObjectKeys,
} from "@fashionmentum/workflow-core";
import {
  DEFAULT_CATEGORY,
  isValidCategory,
  type ImageCategory,
} from "@/lib/images/categories";
import { getSingleImageUpload, imageUploadFileName, ImageUploadError, readImageUploadFormData, validateImageUpload } from "@/lib/images/upload-validation";

config({ path: resolve(process.cwd(), "../../.env") });

const METADATA_FILE = ".metadata.json";

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function refDirFor(productId: string): string {
  return join(getDataRoot(), "products", productId, "reference");
}

function gcsMetaKey(productId: string): string {
  return `products/${productId}/reference/${METADATA_FILE}`;
}

function gcsRefPrefix(productId: string): string {
  return `products/${productId}/reference/`;
}

type MetadataMap = Record<string, { category: ImageCategory }>;

async function readMetadata(productId: string): Promise<MetadataMap> {
  if (usesGcsBlobStorage()) {
    const buf = await getDataObjectBuffer(gcsMetaKey(productId));
    if (!buf) return {};
    try {
      return JSON.parse(buf.toString("utf8")) as MetadataMap;
    } catch {
      return {};
    }
  }
  const metaPath = join(refDirFor(productId), METADATA_FILE);
  try {
    const raw = await readFile(metaPath, "utf8");
    return JSON.parse(raw) as MetadataMap;
  } catch {
    return {};
  }
}

async function writeMetadata(
  productId: string,
  metadata: MetadataMap,
): Promise<void> {
  if (usesGcsBlobStorage()) {
    await putDataObject(
      gcsMetaKey(productId),
      Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      "application/json",
    );
    return;
  }
  const refDir = refDirFor(productId);
  await mkdir(refDir, { recursive: true });
  await writeFile(
    join(refDir, METADATA_FILE),
    JSON.stringify(metadata, null, 2),
  );
}

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { productId } = await params;
  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const metadata = await readMetadata(productId);
    const images: {
      name: string;
      url: string;
      size: number;
      updatedAt: string;
      category: ImageCategory;
    }[] = [];

    if (usesGcsBlobStorage()) {
      const keys = await listDataObjectKeys(gcsRefPrefix(productId));
      for (const key of keys) {
        const base = key.split("/").pop() ?? "";
        if (base === METADATA_FILE || base.startsWith(".")) continue;
        const ext = extname(base).toLowerCase();
        if (!IMAGE_EXT.includes(ext)) continue;
        const meta = await getDataObjectMeta(key);
        if (!meta) continue;
        images.push({
          name: base,
          url: `/api/images/products/${productId}/reference/${encodeURIComponent(base)}`,
          size: meta.size,
          updatedAt: meta.updated.toISOString(),
          category: metadata[base]?.category ?? DEFAULT_CATEGORY,
        });
      }
      return NextResponse.json({ images });
    }

    const refDir = refDirFor(productId);
    const files = await readdir(refDir);
    for (const file of files) {
      if (file === METADATA_FILE) continue;
      const ext = extname(file).toLowerCase();
      if (IMAGE_EXT.includes(ext)) {
        const fileStat = await stat(join(refDir, file));
        images.push({
          name: file,
          url: `/api/images/products/${productId}/reference/${encodeURIComponent(file)}`,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
          category: metadata[file]?.category ?? DEFAULT_CATEGORY,
        });
      }
    }
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { productId } = await params;
  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const formData = await readImageUploadFormData(req);
    const entry = getSingleImageUpload(formData, "files");
    const categoryRaw = formData.get("category") as string | null;
    const category: ImageCategory =
      categoryRaw && isValidCategory(categoryRaw)
        ? categoryRaw
        : DEFAULT_CATEGORY;

    const { buffer, imageType } = await validateImageUpload(entry);
    const safeName = imageUploadFileName(entry.name, imageType.extension);
    const metadata = await readMetadata(productId);
    if (usesGcsBlobStorage()) {
      const key = `${gcsRefPrefix(productId)}${safeName}`;
      await putDataObject(key, buffer, imageType.contentType);
    } else {
      const refDir = refDirFor(productId);
      await mkdir(refDir, { recursive: true });
      await writeFile(join(refDir, safeName), buffer);
    }
    const uploaded = [safeName];
    metadata[safeName] = { category };
    await writeMetadata(productId, metadata);
    return NextResponse.json({ uploaded, count: uploaded.length, category });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Image upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { productId } = await params;
  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { name, category } = body as {
      name: string;
      category: string;
    };

    if (!name || !category || !isValidCategory(category)) {
      return NextResponse.json(
        { error: "Invalid name or category" },
        { status: 400 },
      );
    }

    const metadata = await readMetadata(productId);
    metadata[name] = { category };
    await writeMetadata(productId, metadata);

    return NextResponse.json({ name, category });
  } catch (err) {
    console.error("Category update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { productId } = await params;
  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("name");

    if (!fileName || /[/\\]/.test(fileName)) {
      return NextResponse.json(
        { error: "Invalid file name" },
        { status: 400 },
      );
    }

    if (usesGcsBlobStorage()) {
      const key = `${gcsRefPrefix(productId)}${fileName}`;
      const buf = await getDataObjectBuffer(key);
      if (!buf) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      await deleteDataObject(key);
      const metadata = await readMetadata(productId);
      delete metadata[fileName];
      await writeMetadata(productId, metadata);
      return NextResponse.json({ deleted: fileName });
    }

    const refDir = refDirFor(productId);
    const filePath = join(refDir, fileName);
    const normalizedPath = resolve(filePath);
    const safeBoundary = resolve(refDir);
    if (!normalizedPath.startsWith(safeBoundary)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!existsSync(normalizedPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await unlink(normalizedPath);

    const metadata = await readMetadata(productId);
    delete metadata[fileName];
    await writeMetadata(productId, metadata);

    return NextResponse.json({ deleted: fileName });
  } catch (err) {
    console.error("Image deletion failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deletion failed" },
      { status: 500 },
    );
  }
}
