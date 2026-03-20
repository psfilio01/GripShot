import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { getBrand } from "@/lib/db/brands";
import {
  buildAplusPrompt,
  parseAplusResponse,
  getModuleById,
} from "@/lib/generation/aplus-content";
import { generateText } from "@/lib/generation/gemini-text";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { getPlanLimits } from "@/lib/billing/plans";
import { saveGeneration } from "@/lib/db/generations";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const RequestSchema = z.object({
  productId: z.string().min(1),
  moduleId: z.string().min(1),
  additionalNotes: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const planLimits = getPlanLimits(session.workspace.plan);
    if (!planLimits.aplusEnabled) {
      return NextResponse.json(
        { error: "A+ content requires a Starter or Pro plan. Upgrade to unlock." },
        { status: 403 },
      );
    }

    const quota = await checkQuota(session.user.workspaceId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Quota exceeded", used: quota.used, limit: quota.limit },
        { status: 429 },
      );
    }

    const body = await req.json();
    const input = RequestSchema.parse(body);

    const mod = getModuleById(input.moduleId);
    if (!mod) {
      return NextResponse.json(
        { error: `Unknown A+ module: ${input.moduleId}` },
        { status: 400 },
      );
    }

    const product = await getProduct(session.user.workspaceId, input.productId);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 },
      );
    }

    const brand = await getBrand(session.user.workspaceId, product.brandId);
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const prompt = buildAplusPrompt({
      moduleId: input.moduleId,
      productName: product.name,
      productDescription: product.description,
      brandName: brand.name,
      brandDna: brand.dna,
      additionalNotes: input.additionalNotes || undefined,
    });

    const rawResponse = await generateText(prompt);
    const result = parseAplusResponse(rawResponse);

    await consumeCredit(session.user.workspaceId);

    const generationId = await saveGeneration(session.user.workspaceId, {
      type: "aplus",
      productId: input.productId,
      productName: product.name,
      moduleId: input.moduleId,
      input: { additionalNotes: input.additionalNotes },
      result,
    });

    return NextResponse.json({
      moduleId: input.moduleId,
      moduleName: mod.name,
      amazonModuleType: mod.amazonModuleType,
      content: result,
      prompt,
      generationId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("A+ content generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
