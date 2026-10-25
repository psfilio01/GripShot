import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { checkQuota } from "@/lib/billing/quota";
import {
  createPendingImageGeneration,
  deleteFailedPendingImageGenerationsForProduct,
} from "@/lib/db/pending-image-generations";
import { getProduct } from "@/lib/db/products";
import { runPendingHeroLock } from "@/lib/hero-lock/run-pending";
import { runPendingMainImage } from "@/lib/main-image/run-pending";
import { detectUploadedImageType } from "@/lib/images/uploaded-image-type";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const productIdEntry = formData.get("productId");
    const imageEntry = formData.get("image");
    const modeEntry = formData.get("mode");
    const mode = modeEntry === "main" ? "main" : "hero";
    const productId =
      typeof productIdEntry === "string" ? productIdEntry.trim() : "";

    if (!productId) {
      return NextResponse.json(
        { error: "Select a product." },
        { status: 400 },
      );
    }
    if (!(imageEntry instanceof File) || imageEntry.size === 0) {
      return NextResponse.json(
        { error: "Select an image file." },
        { status: 400 },
      );
    }
    if (imageEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The image exceeds the 10 MB limit." },
        { status: 400 },
      );
    }

    const product = await getProduct(session.user.workspaceId, productId);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    const colors = product.colors ?? [];
    if (colors.length === 0) {
      return NextResponse.json(
        { error: "Add at least one color to the product first." },
        { status: 400 },
      );
    }

    const quota = await checkQuota(session.user.workspaceId, {
      isAdmin: session.isAdmin,
    });
    const maximumOutputCount = colors.length + (mode === "main" ? 1 : 0);
    if (!session.isAdmin && quota.remaining < maximumOutputCount) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          needed: maximumOutputCount,
          remaining: quota.remaining,
        },
        { status: 429 },
      );
    }

    const buffer = Buffer.from(await imageEntry.arrayBuffer());
    const imageType = detectUploadedImageType(buffer);
    if (!imageType) {
      return NextResponse.json(
        { error: "Unsupported image. Use a valid JPEG, PNG, or WebP file." },
        { status: 400 },
      );
    }

    const { registerExternalHeroMaster } = await import(
      "@fashionmentum/workflow-core"
    );
    const master = await registerExternalHeroMaster({
      productId,
      buffer,
      extension: imageType.extension,
      mode,
    });

    const requestId = randomUUID();
    await deleteFailedPendingImageGenerationsForProduct(
      session.user.workspaceId,
      productId,
    );
    await createPendingImageGeneration(session.user.workspaceId, requestId, {
      productId,
      workflowType:
        mode === "main" ? "AMAZON_MAIN_IMAGE_VARIANTS" : "HERO_LOCK_RECOLOR",
      kind: mode,
      expectedVariantCount: maximumOutputCount,
      heroMasterImageId: master.id,
    });

    const targetColors = colors.map((color) => ({
      id: color.id,
      name: color.name,
      hex: color.hex,
    }));

    after(() => {
      const shared = {
        workspaceId: session.user.workspaceId,
        isAdmin: session.isAdmin,
        requestId,
        targetColors,
      };
      return mode === "main"
        ? runPendingMainImage({ ...shared, source: master })
        : runPendingHeroLock({ ...shared, master });
    });

    return NextResponse.json(
      {
        requestId,
        expectedVariantCount: maximumOutputCount,
        masterImageId: master.id,
        mode,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("External Hero upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "External Hero upload failed",
      },
      { status: 500 },
    );
  }
}
