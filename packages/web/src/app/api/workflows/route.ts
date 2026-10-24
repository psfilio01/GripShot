import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  createWorkflow,
  listWorkflows,
  getWorkflowSteps,
  setWorkflowSteps,
} from "@/lib/db/workflows";
import { getWorkflowTemplate } from "@/lib/db/workflow-templates";
import { z } from "zod";

const GlobalSettingsSchema = z.object({
  productId: z.string().max(128).optional(),
  modelId: z.string().max(200).optional(),
  backgroundId: z.string().max(200).optional(),
  outfit: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
});

const CreateWorkflowSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    globalSettings: GlobalSettingsSchema.default({}),
    /** When set, the new workflow is pre-populated with steps from this template. */
    fromTemplateId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const pid = data.globalSettings.productId?.trim();
    if (!pid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product is required",
        path: ["globalSettings", "productId"],
      });
    }
  });

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = CreateWorkflowSchema.parse(body);

    const workflowId = await createWorkflow({
      userId: session.user.uid,
      workspaceId: session.user.workspaceId,
      name: data.name,
      description: data.description,
      globalSettings: data.globalSettings,
    });

    if (data.fromTemplateId) {
      const template = await getWorkflowTemplate(
        session.user.workspaceId,
        data.fromTemplateId,
      );
      if (template && template.steps.length > 0) {
        await setWorkflowSteps(session.user.workspaceId, workflowId, template.steps);
      }
    }

    return NextResponse.json({ workflowId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Workflow creation failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workflows = await listWorkflows(session.user.workspaceId);
  const enriched = await Promise.all(
    workflows.map(async (wf) => {
      const steps = await getWorkflowSteps(session.user.workspaceId, wf.id);
      return {
        ...wf,
        totalSteps: steps.length,
        completedSteps: steps.filter((s) => s.status === "completed").length,
      };
    }),
  );
  return NextResponse.json({ workflows: enriched });
}
