import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  getWorkflowSteps,
  replaceWorkflowStep,
} from "@/lib/db/workflows";
import { replanStep } from "@fashionmentum/workflow-core";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, index: indexStr } = await params;
  const stepIndex = parseInt(indexStr, 10);
  if (Number.isNaN(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      { error: "Invalid step index" },
      { status: 400 },
    );
  }

  try {
    const workflow = await getWorkflow(session.user.workspaceId, id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    const steps = await getWorkflowSteps(session.user.workspaceId, id);
    const existingStep = steps.find((s) => s.index === stepIndex);
    if (!existingStep) {
      return NextResponse.json(
        { error: `Step at index ${stepIndex} not found` },
        { status: 404 },
      );
    }

    const replanned = await replanStep({
      workflowDescription: workflow.description,
      globalSettings: workflow.globalSettings,
      existingSteps: steps.map((s) => ({
        index: s.index,
        type: s.type,
        title: s.title,
        description: s.description,
        promptConfig: s.promptConfig,
      })),
      stepIndex,
    });

    await replaceWorkflowStep(session.user.workspaceId, id, stepIndex, {
      type: replanned.type,
      title: replanned.title,
      description: replanned.description,
      promptConfig: replanned.promptConfig,
    });

    return NextResponse.json({ step: replanned });
  } catch (err) {
    console.error("Step replanning failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
