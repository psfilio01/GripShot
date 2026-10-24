import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  getWorkflowSteps,
  updateWorkflow,
  updateWorkflowStep,
} from "@/lib/db/workflows";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { listHumanModelIds } from "@/lib/db/human-models";
import { getProduct } from "@/lib/db/products";
import { z } from "zod";
import type { StartImageJobInput } from "@fashionmentum/workflow-core";
import { isAllowedGeminiImageModel } from "@fashionmentum/workflow-core";
import {
  zGenerationAspectRatio,
  zGenerationResolution,
} from "@/lib/generation/image-generation-params";

const ExecuteStepSchema = z.object({
  productId: z.string().min(1),
  aspectRatio: zGenerationAspectRatio.optional(),
  resolution: zGenerationResolution.optional(),
  imageModel: z
    .string()
    .optional()
    .refine(
      (v) => v == null || v === "" || isAllowedGeminiImageModel(v),
      { message: "Invalid imageModel" },
    ),
  modelId: z.string().optional(),
  backgroundId: z.string().optional(),
});

function configString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

export async function POST(
  req: NextRequest,
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
    const body = await req.json();
    const parsed = ExecuteStepSchema.parse(body);
    const { productId, aspectRatio, resolution, imageModel, modelId, backgroundId } =
      parsed;

    const workflow = await getWorkflow(session.user.workspaceId, id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    const steps = await getWorkflowSteps(session.user.workspaceId, id);
    const step = steps.find((s) => s.index === stepIndex);
    if (!step) {
      return NextResponse.json(
        { error: `Step ${stepIndex} not found` },
        { status: 404 },
      );
    }

    if (step.status === "generating") {
      return NextResponse.json(
        { error: "Step is already generating" },
        { status: 409 },
      );
    }

    await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
      status: "generating",
    });

    if (workflow.status !== "in_progress") {
      await updateWorkflow(session.user.workspaceId, id, {
        status: "in_progress",
      });
    }

    if (step.type === "image" || step.type === "image_with_text") {
      const quota = await checkQuota(session.user.workspaceId, {
        isAdmin: session.isAdmin,
      });
      if (!quota.allowed) {
        await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
          status: "failed",
        });
        return NextResponse.json(
          { error: "Quota exceeded", used: quota.used, limit: quota.limit },
          { status: 429 },
        );
      }

      const allowedModelIds = await listHumanModelIds(
        session.user.workspaceId,
      );
      const productDoc = await getProduct(
        session.user.workspaceId,
        productId,
      ).catch(() => null);

      const { startImageJob, getJob } = await import(
        "@fashionmentum/workflow-core"
      );

      const pc = step.promptConfig;
      const gs = workflow.globalSettings;

      const mergedAspect =
        aspectRatio ??
        configString(pc.aspectRatio) ??
        configString(gs.aspectRatio) ??
        undefined;
      const mergedResolution =
        resolution ??
        configString(pc.resolution) ??
        configString(gs.resolution) ??
        undefined;

      const fromBodyModel = configString(modelId);
      const mergedModelId =
        fromBodyModel ?? configString(gs.modelId) ?? undefined;

      const fromBodyBg = configString(backgroundId);
      const mergedBackgroundId =
        fromBodyBg ?? configString(gs.backgroundId) ?? undefined;

      const rawImageModel =
        (imageModel && imageModel.trim() !== "" ? imageModel.trim() : undefined) ??
        configString(pc.imageModel) ??
        configString(gs.imageModel) ??
        undefined;
      const mergedImageModel =
        rawImageModel && isAllowedGeminiImageModel(rawImageModel)
          ? rawImageModel
          : undefined;

      const result = await startImageJob({
        productId,
        workflowType:
          (pc.workflowType as StartImageJobInput["workflowType"]) ??
          "NEUTRAL_PRODUCT_SHOT",
        productCategory:
          (pc.productCategory as string) ||
          productDoc?.category ||
          undefined,
        aspectRatio: mergedAspect,
        resolution: mergedResolution,
        poseDescription: configString(pc.poseDescription),
        modelId: mergedModelId,
        backgroundId: mergedBackgroundId,
        allowedModelIds,
        scoreQuality: true,
        userPromptBlock: productDoc?.userPromptBlockCompiled || undefined,
        ...(mergedImageModel ? { imageModel: mergedImageModel } : {}),
      });

      const job = await getJob(result.jobId);
      const imagePath = job.images?.[0]?.filePath;

      await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
        status: "completed",
        resultImagePath: imagePath,
        ...(step.type === "image_with_text"
          ? { resultText: "[Text generation pending]" }
          : {}),
      });

      if (!session.isAdmin) {
        await consumeCredit(session.user.workspaceId);
      }

      const updatedSteps = await getWorkflowSteps(
        session.user.workspaceId,
        id,
      );
      if (updatedSteps.every((s) => s.status === "completed")) {
        await updateWorkflow(session.user.workspaceId, id, {
          status: "completed",
        });
      }

      return NextResponse.json({
        step: {
          index: stepIndex,
          status: "completed",
          resultImagePath: imagePath,
        },
      });
    }

    // Text-only step — placeholder until real text generation is wired
    const generatedText = step.promptConfig.textPrompt
      ? `[Generated text for: ${step.promptConfig.textPrompt}]`
      : "[Generated text placeholder]";

    await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
      status: "completed",
      resultText: generatedText,
    });

    const updatedSteps = await getWorkflowSteps(session.user.workspaceId, id);
    if (updatedSteps.every((s) => s.status === "completed")) {
      await updateWorkflow(session.user.workspaceId, id, {
        status: "completed",
      });
    }

    return NextResponse.json({
      step: { index: stepIndex, status: "completed", resultText: generatedText },
    });
  } catch (err) {
    console.error("Step execution failed:", err);

    try {
      await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
        status: "failed",
      });
    } catch {
      /* best-effort rollback */
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Step execution failed" },
      { status: 500 },
    );
  }
}
