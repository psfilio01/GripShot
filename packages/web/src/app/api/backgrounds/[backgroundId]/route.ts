import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getBackground,
  updateBackground,
  softDeleteBackground,
} from "@/lib/db/backgrounds";
import { z } from "zod";

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

  try {
    await softDeleteBackground(session.user.workspaceId, backgroundId, session.user.uid);
    return NextResponse.json({ ok: true, trashed: true });
  } catch (err) {
    console.error("Background delete failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
