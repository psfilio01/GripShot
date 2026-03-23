import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { getBrand } from "@/lib/db/brands";
import {
  buildListingCopyPrompt,
  parseListingCopyResponse,
} from "@/lib/generation/listing-copy";
import { generateText } from "@/lib/generation/gemini-text";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { saveGeneration } from "@/lib/db/generations";
import { insertGenerationLog, updateGenerationLog } from "@/lib/db/generation-logs";
import { formatGenerationError } from "@/lib/errors/format-generation-error";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const log = createLogger("generate:listing-copy");

const RequestSchema = z.object({
  productId: z.string().min(1),
  keywords: z.string().max(1000).default(""),
  additionalNotes: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const routeStart = Date.now();
  let logId: string | undefined;

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

    const product = await getProduct(
      session.user.workspaceId,
      input.productId,
    );
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

    const prompt = buildListingCopyPrompt({
      product,
      brand,
      keywords: input.keywords || undefined,
      additionalNotes: input.additionalNotes || undefined,
    });

    log.info("Listing copy generation started", {
      userId: session.user.uid,
      productId: input.productId,
      productName: product.name,
    });
    log.debug("Full prompt", { prompt });

    const startTime = Date.now();
    logId = await insertGenerationLog({
      type: "listing-copy",
      workspaceId: session.user.workspaceId,
      userId: session.user.uid,
      userEmail: session.user.email,
      prompt,
      input: { productId: input.productId, keywords: input.keywords, additionalNotes: input.additionalNotes },
      model: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
      status: "started",
    });

    const rawResponse = await generateText(prompt);
    const result = parseListingCopyResponse(rawResponse);
    const durationMs = Date.now() - startTime;

    await updateGenerationLog(logId, { status: "completed", durationMs });

    log.info("Listing copy generation completed", { durationMs, logId });

    if (!session.isAdmin) {
      await consumeCredit(session.user.workspaceId);
    }

    const generationId = await saveGeneration(session.user.workspaceId, {
      type: "listing-copy",
      productId: input.productId,
      productName: product.name,
      input: { keywords: input.keywords, additionalNotes: input.additionalNotes },
      result: result as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ result, prompt, generationId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    const errorMsg = formatGenerationError(err);
    log.error("Listing copy generation failed", {
      error: errorMsg,
      userId: session.user.uid,
    });
    if (logId) {
      await updateGenerationLog(logId, {
        status: "failed",
        durationMs: Date.now() - routeStart,
        errorMessage: errorMsg,
      }).catch(() => {});
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
