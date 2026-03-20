import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { createBrand, listBrands } from "@/lib/db/brands";
import { getPlanLimits } from "@/lib/billing/plans";
import { z } from "zod";

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  isPrivateLabel: z.boolean(),
  dna: z.string().max(2000).default(""),
  targetAudience: z.string().max(500).default(""),
  productCategory: z.string().max(200).default(""),
  tone: z.string().max(500).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const limits = getPlanLimits(session.workspace.plan);
    const existingBrands = await listBrands(session.user.workspaceId);
    if (existingBrands.length >= limits.maxBrands) {
      return NextResponse.json(
        {
          error: `Brand limit reached (${limits.maxBrands} on ${session.workspace.plan} plan). Upgrade for more.`,
          limit: limits.maxBrands,
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const data = CreateBrandSchema.parse(body);

    const brandId = await createBrand({
      workspaceId: session.user.workspaceId,
      ...data,
    });

    return NextResponse.json({ brandId }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Brand creation failed:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const brands = await listBrands(session.user.workspaceId);
  return NextResponse.json({ brands });
}
