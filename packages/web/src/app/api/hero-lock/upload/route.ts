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
import { snapshotProductRecolorSettings } from "@/lib/hero-lock/product-settings";
import { getSingleImageUpload, ImageUploadError, readImageUploadFormData, validateImageUpload } from "@/lib/images/upload-validation";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await readImageUploadFormData(req);
    const productIdEntry = formData.get("productId");
    const imageEntry = getSingleImageUpload(formData, "image");
    const productId =
      typeof productIdEntry === "string" ? productIdEntry.trim() : "";

    if (!productId) {
      return NextResponse.json(
        { error: "Select a product." },
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
    if (!session.isAdmin && quota.remaining < colors.length) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          needed: colors.length,
          remaining: quota.remaining,
        },
        { status: 429 },
      );
    }

    const { buffer, imageType } = await validateImageUpload(imageEntry);

    const { registerExternalHeroMaster } = await import(
      "@fashionmentum/workflow-core"
    );
    const master = await registerExternalHeroMaster({
      productId,
      buffer,
      extension: imageType.extension,
    });

    const requestId = randomUUID();
    await deleteFailedPendingImageGenerationsForProduct(
      session.user.workspaceId,
      productId,
    );
    await createPendingImageGeneration(session.user.workspaceId, requestId, {
      productId,
      workflowType: "HERO_LOCK_RECOLOR",
      kind: "hero",
      expectedVariantCount: colors.length,
      heroMasterImageId: master.id,
    });

    const { targetColors, recolorPolicy } = snapshotProductRecolorSettings(product);

    after(() =>
      runPendingHeroLock({
        workspaceId: session.user.workspaceId,
        isAdmin: session.isAdmin,
        requestId,
        master,
        targetColors,
        recolorPolicy,
      }),
    );

    return NextResponse.json(
      {
        requestId,
        expectedVariantCount: colors.length,
        masterImageId: master.id,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
