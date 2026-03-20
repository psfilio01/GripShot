import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct, updateProduct, deleteProduct } from "@/lib/db/products";
import { z } from "zod";

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function GET(
  _req: NextRequest,
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

  return NextResponse.json({ product });
}

export async function PATCH(
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
    const data = UpdateProductSchema.parse(body);

    await updateProduct(session.user.workspaceId, productId, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Product update failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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
    await deleteProduct(session.user.workspaceId, productId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Product deletion failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
