import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { config } from "dotenv";
import { resolve, join, extname } from "path";
import { mkdir, readdir, stat, writeFile } from "fs/promises";

config({ path: resolve(process.cwd(), "../../.env") });

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
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
    const images = [];
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
        const fileStat = await stat(join(refDir, file));
        images.push({
          name: file,
          url: `/api/images/products/${productId}/reference/${file}`,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
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

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const refDir = join(getDataRoot(), "products", productId, "reference");
    await mkdir(refDir, { recursive: true });

    const uploaded: string[] = [];

    for (const entry of files) {
      if (!(entry instanceof File)) continue;

      if (!ALLOWED_TYPES.has(entry.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${entry.type}. Use JPEG, PNG, or WebP.` },
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
      uploaded.push(safeName);
    }

    return NextResponse.json({ uploaded, count: uploaded.length });
  } catch (err) {
    console.error("Image upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
