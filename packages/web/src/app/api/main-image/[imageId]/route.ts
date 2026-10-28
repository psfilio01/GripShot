import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";

type Context = { params: Promise<{ imageId: string }> };
const ImageId = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);

async function authorize(context: Context) {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { imageId } = await context.params;
  if (!ImageId.safeParse(imageId).success) return { error: NextResponse.json({ error: "Invalid image id." }, { status: 400 }) };
  const { metadataStore } = await import("@fashionmentum/workflow-core");
  const variant = await metadataStore.getVariantById(imageId);
  const product = variant ? await getProduct(session.user.workspaceId, variant.productId) : null;
  if (!variant?.mainImage || !product || product.deletedAt) return { error: NextResponse.json({ error: "Main image not found." }, { status: 404 }) };
  return { imageId, metadataStore };
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const auth = await authorize(context);
    if (auth.error) return auth.error;
    const parsed = z.object({ reviewed: z.boolean() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Set reviewed to true or false." }, { status: 400 });
    const variant = await auth.metadataStore!.setMainImageReviewed(auth.imageId!, parsed.data.reviewed);
    if (!variant) return NextResponse.json({ error: "Main image not found." }, { status: 404 });
    return NextResponse.json({ ok: true, mainImage: variant.mainImage });
  } catch (error) {
    console.error("Main-image review failed:", error);
    return NextResponse.json({ error: "Main-image review could not be saved." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const auth = await authorize(context);
    if (auth.error) return auth.error;
    const { deleteMainImage } = await import("@fashionmentum/workflow-core");
    if (!await deleteMainImage(auth.imageId!)) return NextResponse.json({ error: "Main image not found." }, { status: 404 });
    return NextResponse.json({ ok: true, deletedImageIds: [auth.imageId] });
  } catch (error) {
    console.error("Main-image deletion failed:", error);
    return NextResponse.json({ error: "Main image could not be deleted." }, { status: 500 });
  }
}
