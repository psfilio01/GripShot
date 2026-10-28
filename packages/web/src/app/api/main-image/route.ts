import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import { createPendingImageGeneration } from "@/lib/db/pending-image-generations";
import { runPendingMainImage } from "@/lib/main-image/run-pending";

export const runtime = "nodejs";
export const maxDuration = 600;

const Input = z.object({ imageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/), preserveShadow: z.boolean().default(true) }).strict();

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select an image and valid shadow option." }, { status: 400 });
  try {
    const { metadataStore } = await import("@fashionmentum/workflow-core");
    const source = await metadataStore.getVariantById(parsed.data.imageId);
    const product = source ? await getProduct(session.user.workspaceId, source.productId) : null;
    if (!source || !product || product.deletedAt) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    if (source.mainImage) return NextResponse.json({ error: "Select the original image, not another Main copy." }, { status: 400 });
    const requestId = randomUUID();
    await createPendingImageGeneration(session.user.workspaceId, requestId, {
      productId: source.productId, workflowType: "MAIN_WHITE_BACKGROUND", kind: "main", mainSourceImageId: source.id, expectedVariantCount: 1,
    });
    after(() => runPendingMainImage({ workspaceId: session.user.workspaceId, requestId, sourceImageId: source.id, productId: source.productId, preserveShadow: parsed.data.preserveShadow }));
    return NextResponse.json({ requestId, sourceImageId: source.id }, { status: 202 });
  } catch (error) {
    console.error("Main-image submission failed:", error);
    return NextResponse.json({ error: "Main-image processing could not be started." }, { status: 500 });
  }
}
