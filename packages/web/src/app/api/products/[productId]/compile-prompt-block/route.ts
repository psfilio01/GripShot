import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct, updateProduct } from "@/lib/db/products";
import { z } from "zod";

const BodySchema = z.object({
  rawText: z.string().max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { productId } = await params;

  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { rawText } = BodySchema.parse(body);

    const { compileUserPromptBlock } = await import(
      "@fashionmentum/workflow-core"
    );

    const result = await compileUserPromptBlock(rawText, product.name);

    await updateProduct(session.user.workspaceId, productId, {
      userPromptBlockRaw: rawText,
      userPromptBlockCompiled: result.compiledText,
    } as Record<string, string>);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Prompt block compilation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Compilation failed" },
      { status: 500 },
    );
  }
}
