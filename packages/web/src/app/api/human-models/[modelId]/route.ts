import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getHumanModel,
  updateHumanModel,
  deleteHumanModelDoc,
} from "@/lib/db/human-models";
import { z } from "zod";
import { config } from "dotenv";
import { resolve, join } from "path";
import { rm } from "fs/promises";
import { existsSync } from "fs";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

const PatchSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  notes: z.string().max(500).optional(),
});

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

  return NextResponse.json({ model });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
    const body = await req.json();
    const data = PatchSchema.parse(body);
    await updateHumanModel(session.user.workspaceId, modelId, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Human model update failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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
    const modelDir = join(getDataRoot(), "models", modelId);
    if (existsSync(modelDir)) {
      await rm(modelDir, { recursive: true, force: true });
    }
    await deleteHumanModelDoc(session.user.workspaceId, modelId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Human model delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}
