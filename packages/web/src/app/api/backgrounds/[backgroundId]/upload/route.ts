import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getBackground } from "@/lib/db/backgrounds";
import { resolve, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

type Params = { params: Promise<{ backgroundId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { backgroundId } = await params;
  const bg = await getBackground(session.user.workspaceId, backgroundId);
  if (!bg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type: ${file.type}. Use JPEG, PNG, or WebP.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit." },
        { status: 400 },
      );
    }

    const dir = join(getDataRoot(), "backgrounds", backgroundId);
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = join(dir, safeName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      url: `/api/images/backgrounds/${backgroundId}/${safeName}`,
      filename: safeName,
    });
  } catch (err) {
    console.error("Background upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
