import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const RequestSchema = z.object({
  productId: z.string().min(1),
  workflowType: z.enum(["NEUTRAL_PRODUCT_SHOT", "AMAZON_LIFESTYLE_SHOT"]),
  useGoldenBackground: z.boolean().default(false),
  creativeFreedom: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const input = RequestSchema.parse(body);

    const { startImageJob, getJob } = await import(
      "@fashionmentum/workflow-core"
    );

    const { jobId } = await startImageJob({
      productId: input.productId,
      workflowType: input.workflowType,
      useGoldenBackground: input.useGoldenBackground,
      creativeFreedom: input.creativeFreedom,
    });

    const job = await getJob(jobId);

    return NextResponse.json({ job });
  } catch (err) {
    console.error("Image generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
