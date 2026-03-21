import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { config } from "dotenv";
import { resolve, join, extname } from "path";
import { mkdir, readdir, stat, writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import {
  DEFAULT_CATEGORY,
  isValidCategory,
  type ImageCategory,
} from "@/lib/images/categories";

config({ path: resolve(process.cwd(), "../../.env") });

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const METADATA_FILE = ".metadata.json";

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

type MetadataMap = Record<string, { category: ImageCategory }>;

async function readMetadata(refDir: string): Promise<MetadataMap> {
  const metaPath = join(refDir, METADATA_FILE);
  try {
    const raw = await readFile(metaPath, "utf8");
    return JSON.parse(raw) as MetadataMap;
  } catch {
    return {};
  }
}

async function writeMetadata(
  refDir: string,
  metadata: MetadataMap,
): Promise<void> {
  await writeFile(
    join(refDir, METADATA_FILE),
    JSON.stringify(metadata, null, 2),
  );
}

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

  const refDir = join(getDataRoot(), "products", productId, "reference");
  try {
    const files = await readdir(refDir);
    const metadata = await readMetadata(refDir);
    const images = [];
    for (const file of files) {
      if (file === METADATA_FILE) continue;
      const ext = extname(file).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
        const fileStat = await stat(join(refDir, file));
        images.push({
          name: file,
          url: `/api/images/products/${productId}/reference/${file}`,
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
    const formData = await req.formData();
    const files = formData.getAll("files");
    const categoryRaw = formData.get("category") as string | null;
    const category: ImageCategory =
      categoryRaw && isValidCategory(categoryRaw)
        ? categoryRaw
        : DEFAULT_CATEGORY;

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 },
      );
    }

    const refDir = join(getDataRoot(), "products", productId, "reference");
    await mkdir(refDir, { recursive: true });

    const metadata = await readMetadata(refDir);
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
      const destPath = join(refDir, safeName);

      await writeFile(destPath, buffer);
      metadata[safeName] = { category };
      uploaded.push(safeName);
    }

    await writeMetadata(refDir, metadata);
    return NextResponse.json({ uploaded, count: uploaded.length, category });
  } catch (err) {
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

    const refDir = join(getDataRoot(), "products", productId, "reference");
    const metadata = await readMetadata(refDir);
    metadata[name] = { category };
    await writeMetadata(refDir, metadata);

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

    const refDir = join(getDataRoot(), "products", productId, "reference");
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

    const metadata = await readMetadata(refDir);
    delete metadata[fileName];
    await writeMetadata(refDir, metadata);

    return NextResponse.json({ deleted: fileName });
  } catch (err) {
    console.error("Image deletion failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deletion failed" },
      { status: 500 },
    );
  }
}
