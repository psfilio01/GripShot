import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  getWorkflow,
  getWorkflowSteps,
  updateWorkflowStep,
} from "@/lib/db/workflows";
import { getProduct } from "@/lib/db/products";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { z } from "zod";
import type { WorkflowStepColorVariant } from "@/lib/db/types";
import { snapshotProductRecolorSettings } from "@/lib/hero-lock/product-settings";

const HeroLockSchema = z.object({
  productId: z.string().min(1),
});

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
    const { productId } = HeroLockSchema.parse(body);

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

    if (step.status !== "completed" || !step.resultImagePath) {
      return NextResponse.json(
        { error: "Step must be completed with an image" },
        { status: 400 },
      );
    }

    const product = await getProduct(session.user.workspaceId, productId);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 },
      );
    }

    const colors = product.colors ?? [];
    if (colors.length === 0) {
      return NextResponse.json(
        { error: "Product has no colors defined" },
        { status: 400 },
      );
    }

    const creditsNeeded = colors.length;
    const quota = await checkQuota(session.user.workspaceId, {
      isAdmin: session.isAdmin,
    });
    if (!session.isAdmin && quota.remaining < creditsNeeded) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          needed: creditsNeeded,
          remaining: quota.remaining,
        },
        { status: 429 },
      );
    }

    const { executeHeroLock } = await import("@fashionmentum/workflow-core");
    const { randomUUID } = await import("node:crypto");

    const syntheticVariant = {
      id: randomUUID(),
      jobId: `workflow-${id}-step-${stepIndex}`,
      productId,
      status: "hero_lock" as const,
      filePath: step.resultImagePath,
      createdAt: new Date().toISOString(),
    };

    const { targetColors, recolorPolicy } = snapshotProductRecolorSettings(product);

    const result = await executeHeroLock(syntheticVariant, targetColors, { recolorPolicy });

    const colorVariants: WorkflowStepColorVariant[] = result.generatedVariants.map(
      (v) => ({
        colorId: targetColors.find((c) => c.name === v.colorName)?.id ?? v.variantId,
        colorName: v.colorName,
        colorHex: v.colorHex,
        imagePath: v.filePath ?? "",
        status: v.status === "completed" ? ("completed" as const) : ("failed" as const),
      }),
    );

    await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
      colorVariants,
    });

    if (!session.isAdmin) {
      const successCount = colorVariants.filter(
        (v) => v.status === "completed",
      ).length;
      if (successCount > 0) {
        await consumeCredit(session.user.workspaceId, successCount);
      }
    }

    return NextResponse.json({
      colorVariants,
      skippedColors: result.skippedColors,
    });
  } catch (err) {
    console.error("Workflow Hero Lock failed:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Hero Lock generation failed" },
      { status: 500 },
    );
  }
}
