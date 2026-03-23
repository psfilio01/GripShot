import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { listHumanModelIds } from "@/lib/db/human-models";
import { insertGenerationLog } from "@/lib/db/generation-logs";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const log = createLogger("generate:image");

const ASPECT_RATIOS = [
  "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
  "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
] as const;

const RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

const RequestSchema = z.object({
  productId: z.string().min(1),
  workflowType: z.enum(["NEUTRAL_PRODUCT_SHOT", "AMAZON_LIFESTYLE_SHOT"]),
  useGoldenBackground: z.boolean().default(false),
  creativeFreedom: z.boolean().default(false),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  resolution: z.enum(RESOLUTIONS).optional(),
  modelId: z.string().optional(),
  backgroundId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    const quota = await checkQuota(session.user.workspaceId, {
      isAdmin: session.isAdmin,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 },
      );
    }

    const body = await req.json();
    const input = RequestSchema.parse(body);

    log.info("Image generation requested", {
      userId: session.user.uid,
      workflowType: input.workflowType,
      productId: input.productId,
      modelId: input.modelId,
      backgroundId: input.backgroundId,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      isAdmin: session.isAdmin,
    });

    const allowedModelIds = await listHumanModelIds(session.user.workspaceId);
    const trimmedModelId = input.modelId?.trim();
    if (trimmedModelId && !allowedModelIds.includes(trimmedModelId)) {
      return NextResponse.json(
        { error: "Selected model is not in your workspace." },
        { status: 400 },
      );
    }

    const { startImageJob, getJob } = await import(
      "@fashionmentum/workflow-core"
    );

    const result = await startImageJob({
      productId: input.productId,
      workflowType: input.workflowType,
      useGoldenBackground: input.useGoldenBackground,
      creativeFreedom: input.creativeFreedom,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      modelId: trimmedModelId || undefined,
      allowedModelIds,
      backgroundId: input.backgroundId?.trim() || undefined,
    });

    const job = await getJob(result.jobId);
    const durationMs = Date.now() - startTime;

    await insertGenerationLog({
      type: "image",
      workspaceId: session.user.workspaceId,
      userId: session.user.uid,
      userEmail: session.user.email,
      prompt: result.promptText ?? "(unavailable)",
      input: {
        workflowType: input.workflowType,
        productId: input.productId,
        modelId: trimmedModelId,
        backgroundId: input.backgroundId,
        useGoldenBackground: input.useGoldenBackground,
        creativeFreedom: input.creativeFreedom,
      },
      model: process.env.NANOBANANA_MODEL ?? "unknown",
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      referenceImageCount: result.referenceImageCount,
      durationMs,
      status: "completed",
    });

    log.info("Image generation completed", {
      jobId: result.jobId,
      durationMs,
      imageCount: job.images?.length ?? 0,
      referenceImages: result.referenceImageCount,
    });

    if (!session.isAdmin) {
      await consumeCredit(session.user.workspaceId);
    }

    return NextResponse.json({ job });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("Image generation failed", {
      error: errorMsg,
      userId: session.user.uid,
    });

    await insertGenerationLog({
      type: "image",
      workspaceId: session.user.workspaceId,
      userId: session.user.uid,
      userEmail: session.user.email,
      prompt: "(failed before prompt was captured)",
      input: {},
      model: process.env.NANOBANANA_MODEL ?? "unknown",
      durationMs: Date.now() - startTime,
      status: "failed",
      errorMessage: errorMsg,
    }).catch(() => {});

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 },
    );
  }
}
