import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  getWorkflowSteps,
  softDeleteStepImage,
  restoreStepImage,
} from "@/lib/db/workflows";

type Params = { params: Promise<{ id: string; index: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, index } = await params;
  const stepIndex = parseInt(index, 10);
  if (isNaN(stepIndex)) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

  const workflow = await getWorkflow(session.user.workspaceId, id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    await softDeleteStepImage(session.user.workspaceId, id, stepIndex, session.user.uid);
    return NextResponse.json({ success: true, trashed: true });
  } catch (err) {
    console.error("Step image delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, index } = await params;
  const stepIndex = parseInt(index, 10);
  if (isNaN(stepIndex)) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

  const workflow = await getWorkflow(session.user.workspaceId, id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    await restoreStepImage(session.user.workspaceId, id, stepIndex);
    const steps = await getWorkflowSteps(session.user.workspaceId, id);
    const step = steps.find((s) => s.index === stepIndex);
    return NextResponse.json({ success: true, step });
  } catch (err) {
    console.error("Step image restore failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 500 },
    );
  }
}
