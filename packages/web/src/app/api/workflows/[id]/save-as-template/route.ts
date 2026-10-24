import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getWorkflow, getWorkflowSteps } from "@/lib/db/workflows";
import { createWorkflowTemplate } from "@/lib/db/workflow-templates";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const workflow = await getWorkflow(session.user.workspaceId, id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    const steps = await getWorkflowSteps(session.user.workspaceId, id);

    const templateSteps = steps.map((s) => ({
      index: s.index,
      type: s.type,
      title: s.title,
      description: s.description,
      promptConfig: s.promptConfig,
    }));

    const templateId = await createWorkflowTemplate(
      session.user.workspaceId,
      {
        name: workflow.name,
        description: workflow.description,
        globalSettings: workflow.globalSettings,
        steps: templateSteps,
      },
    );

    return NextResponse.json({ templateId }, { status: 201 });
  } catch (err) {
    console.error("Save workflow as template failed:", err);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 },
    );
  }
}
