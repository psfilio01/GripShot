import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  listHumanModels,
  createHumanModel,
} from "@/lib/db/human-models";
import { z } from "zod";
import { resolve, join, extname } from "path";
import { readdirSync } from "fs";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const CreateSchema = z.object({
  displayName: z.string().min(1).max(120),
  notes: z.string().max(500).optional(),
  source: z.enum(["human", "ai"]).optional(),
  aiPrompt: z.string().max(2000).optional(),
  gender: z.string().max(50).optional(),
  ageRange: z.string().max(50).optional(),
  bodyBuild: z.string().max(50).optional(),
  ethnicity: z.string().max(100).optional(),
  hairColor: z.string().max(50).optional(),
  hairLength: z.string().max(50).optional(),
  skinTone: z.string().max(50).optional(),
  height: z.string().max(50).optional(),
});

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function getFirstImage(modelId: string): string | null {
  const dir = join(getDataRoot(), "models", modelId, "reference");
  try {
    const files = readdirSync(dir);
    const img = files.find((f) => {
      const ext = extname(f).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    });
    return img
      ? `/api/images/models/${modelId}/reference/${img}`
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const models = await listHumanModels(session.user.workspaceId);
  const modelsWithThumb = models.map((m) => ({
    ...m,
    thumbnailUrl: getFirstImage(m.id),
  }));
  return NextResponse.json({ models: modelsWithThumb });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);
    const modelId = await createHumanModel({
      workspaceId: session.user.workspaceId,
      displayName: data.displayName,
      notes: data.notes,
      source: data.source,
      aiPrompt: data.aiPrompt,
      gender: data.gender,
      ageRange: data.ageRange,
      bodyBuild: data.bodyBuild,
      ethnicity: data.ethnicity,
      hairColor: data.hairColor,
      hairLength: data.hairLength,
      skinTone: data.skinTone,
      height: data.height,
    });
    return NextResponse.json({ modelId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Human model create failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
