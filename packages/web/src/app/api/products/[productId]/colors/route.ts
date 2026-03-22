import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getProduct } from "@/lib/db/products";
import {
  listProductColors,
  addProductColor,
  updateProductColor,
  deleteProductColor,
  CreateColorSchema,
  ProductColorSchema,
} from "@/lib/db/product-colors";
import { z } from "zod";

type Params = { params: Promise<{ productId: string }> };

async function requireProduct(productId: string) {
  const session = await getServerSession();
  if (!session) return { error: "Not authenticated", status: 401 } as const;
  const product = await getProduct(session.user.workspaceId, productId);
  if (!product) return { error: "Product not found", status: 404 } as const;
  return { session, product } as const;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { productId } = await params;
  const auth = await requireProduct(productId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const colors = await listProductColors(
    auth.session.user.workspaceId,
    productId,
  );
  return NextResponse.json({ colors });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { productId } = await params;
  const auth = await requireProduct(productId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const data = CreateColorSchema.parse(body);
    const color = await addProductColor(
      auth.session.user.workspaceId,
      productId,
      data,
    );
    return NextResponse.json({ color }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Color creation failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { productId } = await params;
  const auth = await requireProduct(productId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = ProductColorSchema.partial().extend({
      id: z.string().min(1),
    }).parse(body);

    const color = await updateProductColor(
      auth.session.user.workspaceId,
      productId,
      id,
      updates,
    );

    if (!color) {
      return NextResponse.json({ error: "Color not found" }, { status: 404 });
    }

    return NextResponse.json({ color });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Color update failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { productId } = await params;
  const auth = await requireProduct(productId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const colorId = searchParams.get("id");
  if (!colorId) {
    return NextResponse.json({ error: "Missing color id" }, { status: 400 });
  }

  const deleted = await deleteProductColor(
    auth.session.user.workspaceId,
    productId,
    colorId,
  );

  if (!deleted) {
    return NextResponse.json({ error: "Color not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
