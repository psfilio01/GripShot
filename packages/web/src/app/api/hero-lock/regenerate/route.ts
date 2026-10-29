import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/server-session";
import { checkQuota } from "@/lib/billing/quota";
import { getProduct } from "@/lib/db/products";
import {
  createPendingImageGeneration,
  hasRunningHeroColorRegeneration,
} from "@/lib/db/pending-image-generations";
import { runPendingHeroLock } from "@/lib/hero-lock/run-pending";
import { snapshotProductRecolorSettings } from "@/lib/hero-lock/product-settings";
import type { ProductColorDef, ProductRecolorPolicy } from "@fashionmentum/workflow-core";

export const runtime = "nodejs";
export const maxDuration = 600;

const Input = z.object({
  imageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();

/**
 * Re-runs exactly one colour using the immutable Hero master, never the previous
 * generated image. The original variant is retained so the user can compare it.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select one valid color variant." }, { status: 400 });
  }

  try {
    const { metadataStore } = await import("@fashionmentum/workflow-core");
    const source = await metadataStore.getVariantById(parsed.data.imageId);
    if (!source?.colorLineage || source.mainImage) {
      return NextResponse.json(
        { error: "Select an original Hero color variant, not a Main copy." },
        { status: 400 },
      );
    }

    const product = await getProduct(session.user.workspaceId, source.productId);
    if (!product || product.deletedAt) {
      return NextResponse.json({ error: "Image or product not found." }, { status: 404 });
    }

    const master = await metadataStore.getVariantById(
      source.colorLineage.parentVariantId,
    );
    if (
      !master ||
      master.status !== "hero_lock" ||
      master.productId !== source.productId
    ) {
      return NextResponse.json(
        { error: "The original Hero master is no longer available." },
        { status: 409 },
      );
    }

    const workspaceId = session.user.workspaceId;
    if (await hasRunningHeroColorRegeneration(workspaceId, source.id)) {
      return NextResponse.json(
        { error: "This color variant is already being regenerated." },
        { status: 409 },
      );
    }

    let targetColor: ProductColorDef;
    let recolorPolicy: ProductRecolorPolicy;
    const savedRules = source.colorLineage.provenance?.rules;
    if (savedRules) {
      // Keep the exact instructions that were in force for the first result.
      targetColor = {
        id: `retry-${source.id}`,
        name: source.colorLineage.targetColorName,
        hex: source.colorLineage.targetColorHex,
        ...(savedRules.targetColorNotes.trim()
          ? { notes: savedRules.targetColorNotes }
          : {}),
      };
      recolorPolicy = savedRules.policy;
    } else {
      // Older variants did not store a snapshot. Only retry when the matching
      // product color still exists, rather than silently applying a new color.
      const currentColor = (product.colors ?? []).find(
        (color) =>
          color.name === source.colorLineage!.targetColorName &&
          color.hex.toLowerCase() === source.colorLineage!.targetColorHex.toLowerCase(),
      );
      if (!currentColor) {
        return NextResponse.json(
          { error: "This older variant has no matching saved color configuration. Start a new Hero run instead." },
          { status: 409 },
        );
      }
      const settings = snapshotProductRecolorSettings(product, [currentColor.id]);
      targetColor = settings.targetColors[0]!;
      recolorPolicy = settings.recolorPolicy;
    }

    const quota = await checkQuota(workspaceId, { isAdmin: session.isAdmin });
    if (!session.isAdmin && quota.remaining < 1) {
      return NextResponse.json(
        { error: "Insufficient credits", needed: 1, remaining: quota.remaining },
        { status: 429 },
      );
    }

    const requestId = randomUUID();
    await createPendingImageGeneration(workspaceId, requestId, {
      productId: source.productId,
      workflowType: "HERO_LOCK_RECOLOR",
      kind: "hero",
      expectedVariantCount: 1,
      heroMasterImageId: master.id,
      regeneratedFromImageId: source.id,
      heroColorName: targetColor.name,
    });

    after(() =>
      runPendingHeroLock({
        workspaceId,
        isAdmin: session.isAdmin,
        requestId,
        master: { ...master },
        targetColors: [{ ...targetColor }],
        recolorPolicy,
        regeneratedFromVariantId: source.id,
      }),
    );

    return NextResponse.json(
      { requestId, heroMasterImageId: master.id, colorName: targetColor.name },
      { status: 202 },
    );
  } catch (error) {
    console.error("Hero color regeneration submission failed:", error);
    return NextResponse.json(
      { error: "Color regeneration could not be started." },
      { status: 500 },
    );
  }
}
