import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  listHumanModels,
  createHumanModel,
} from "@/lib/db/human-models";
import { z } from "zod";

const CreateSchema = z.object({
  displayName: z.string().min(1).max(120),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const models = await listHumanModels(session.user.workspaceId);
  return NextResponse.json({ models });
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
