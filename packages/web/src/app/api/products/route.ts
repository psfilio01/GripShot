import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { createProduct, listProducts } from "@/lib/db/products";
import { z } from "zod";

const CreateProductSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = CreateProductSchema.parse(body);

    const productId = await createProduct({
      workspaceId: session.user.workspaceId,
      ...data,
    });

    return NextResponse.json({ productId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Product creation failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const products = await listProducts(session.user.workspaceId);
  return NextResponse.json({ products });
}
