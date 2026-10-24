import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  getWorkflowSteps,
  updateWorkflow,
  softDeleteWorkflow,
} from "@/lib/db/workflows";
import { z } from "zod";
import {
  isAllowedGeminiImageModel,
} from "@fashionmentum/workflow-core";
import {
  zGenerationAspectRatio,
  zGenerationResolution,
} from "@/lib/generation/image-generation-params";

const PatchWorkflowSchema = z
  .object({
    globalSettings: z
      .object({
        modelId: z.string().optional(),
        backgroundId: z.string().optional(),
        outfit: z.string().optional(),
        language: z.string().optional(),
        aspectRatio: zGenerationAspectRatio.optional(),
        resolution: zGenerationResolution.optional(),
        imageModel: z
          .string()
          .optional()
          .refine(
            (v) => v == null || v === "" || isAllowedGeminiImageModel(v),
            { message: "Invalid imageModel" },
          ),
        productId: z.string().max(128).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const workflow = await getWorkflow(session.user.workspaceId, id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const steps = await getWorkflowSteps(session.user.workspaceId, id);

  return NextResponse.json({ workflow, steps });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const workflow = await getWorkflow(session.user.workspaceId, id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = PatchWorkflowSchema.parse(body);
    if (parsed.globalSettings === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    const gs = { ...parsed.globalSettings };

    await updateWorkflow(session.user.workspaceId, id, {
      globalSettings: gs,
    });

    const updated = await getWorkflow(session.user.workspaceId, id);
    return NextResponse.json({ workflow: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Workflow PATCH failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const workflow = await getWorkflow(session.user.workspaceId, id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  try {
    await softDeleteWorkflow(session.user.workspaceId, id, session.user.uid);
    return NextResponse.json({ success: true, trashed: true });
  } catch (err) {
    console.error("Workflow delete failed:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
