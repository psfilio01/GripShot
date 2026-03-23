import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getBackground,
  updateBackground,
  deleteBackground,
} from "@/lib/db/backgrounds";
import { z } from "zod";
import { resolve, join } from "path";
import { rm } from "fs/promises";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

type Params = { params: Promise<{ backgroundId: string }> };

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { backgroundId } = await params;
  const bg = await getBackground(session.user.workspaceId, backgroundId);
  if (!bg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(bg);
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
    const body = await req.json();
    const data = UpdateSchema.parse(body);
    await updateBackground(session.user.workspaceId, backgroundId, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { backgroundId } = await params;
  const bg = await getBackground(session.user.workspaceId, backgroundId);
  if (!bg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dir = join(getDataRoot(), "backgrounds", backgroundId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* directory may not exist */
  }

  await deleteBackground(session.user.workspaceId, backgroundId);
  return NextResponse.json({ ok: true });
}
