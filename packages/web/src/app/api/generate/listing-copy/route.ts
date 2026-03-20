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
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

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

    const rawResponse = await generateText(prompt);
    const result = parseListingCopyResponse(rawResponse);

    await consumeCredit(session.user.workspaceId);

    return NextResponse.json({ result, prompt });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Listing copy generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
