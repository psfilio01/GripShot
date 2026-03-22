import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { listHumanModelIds } from "@/lib/db/human-models";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

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
  /** Human model id from workspace; omit or empty for random among workspace models. */
  modelId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const quota = await checkQuota(session.user.workspaceId);
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

    const { jobId } = await startImageJob({
      productId: input.productId,
      workflowType: input.workflowType,
      useGoldenBackground: input.useGoldenBackground,
      creativeFreedom: input.creativeFreedom,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      modelId: trimmedModelId || undefined,
      allowedModelIds,
    });

    const job = await getJob(jobId);

    await consumeCredit(session.user.workspaceId);

    return NextResponse.json({ job });
  } catch (err) {
    console.error("Image generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
