import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listBackgrounds, createBackground } from "@/lib/db/backgrounds";
import { z } from "zod";
import { resolve, join, extname } from "path";
import { readdirSync } from "fs";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["canvas", "freestyle", "upload"]),
  description: z.string().max(2000).optional(),
});

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function getPreviewUrl(backgroundId: string): string | null {
  const dir = join(getDataRoot(), "backgrounds", backgroundId);
  try {
    const files = readdirSync(dir);
    const img = files.find((f) => {
      const ext = extname(f).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    });
    return img ? `/api/images/backgrounds/${backgroundId}/${img}` : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const backgrounds = await listBackgrounds(session.user.workspaceId);
  const withPreviews = backgrounds.map((bg) => ({
    ...bg,
    previewUrl: getPreviewUrl(bg.id),
  }));
  return NextResponse.json({ backgrounds: withPreviews });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);
    const backgroundId = await createBackground({
      workspaceId: session.user.workspaceId,
      name: data.name,
      type: data.type,
      description: data.description ?? "",
    });
    return NextResponse.json({ backgroundId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Background create failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
