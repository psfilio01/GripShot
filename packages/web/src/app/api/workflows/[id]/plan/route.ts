import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getWorkflow, setWorkflowSteps } from "@/lib/db/workflows";
import { planWorkflow } from "@fashionmentum/workflow-core";

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

    if (workflow.status !== "draft" && workflow.status !== "planned") {
      return NextResponse.json(
        {
          error: `Cannot plan a workflow in status "${workflow.status}". Only draft or planned workflows can be (re-)planned.`,
        },
        { status: 409 },
      );
    }

    const planned = await planWorkflow({
      description: workflow.description,
      globalSettings: workflow.globalSettings,
    });

    await setWorkflowSteps(
      session.user.workspaceId,
      id,
      planned.map((s) => ({
        index: s.index,
        type: s.type,
        title: s.title,
        description: s.description,
        promptConfig: s.promptConfig,
      })),
    );

    return NextResponse.json({ steps: planned });
  } catch (err) {
    console.error("Workflow planning failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
