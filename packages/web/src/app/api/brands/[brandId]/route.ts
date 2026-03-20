import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getBrand, updateBrand, deleteBrand } from "@/lib/db/brands";
import { z } from "zod";

const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isPrivateLabel: z.boolean().optional(),
  dna: z.string().max(2000).optional(),
  targetAudience: z.string().max(500).optional(),
  productCategory: z.string().max(200).optional(),
  tone: z.string().max(500).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { brandId } = await params;
  const brand = await getBrand(session.user.workspaceId, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  return NextResponse.json({ brand });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { brandId } = await params;
  const brand = await getBrand(session.user.workspaceId, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = UpdateBrandSchema.parse(body);

    await updateBrand(session.user.workspaceId, brandId, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Brand update failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { brandId } = await params;
  const brand = await getBrand(session.user.workspaceId, brandId);
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    await deleteBrand(session.user.workspaceId, brandId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Brand deletion failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
