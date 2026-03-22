import { metadataStore } from "./metadataStore";
import { moveImage } from "./resultStorage";
import { executeHeroLock, type HeroLockResult } from "./heroLockOrchestrator";
import type { FeedbackEvent } from "../types/api";
import type { ImageVariant } from "../domain/imageVariant";

interface HandleFeedbackInternalResult {
  updatedVariant: ImageVariant | null;
  newJobIds: string[];
  heroLockResult?: HeroLockResult;
}

export async function handleFeedbackInternal(
  event: FeedbackEvent,
): Promise<HandleFeedbackInternalResult> {
  const variant = await metadataStore.getVariantById(event.imageId);
  if (!variant) {
    return { updatedVariant: null, newJobIds: [] };
  }

  if (event.action === "favorite" || event.action === "reject") {
    const bucket = event.action === "favorite" ? "favorites" : "rejected";
    const newStatus: ImageVariant["status"] =
      event.action === "favorite" ? "favorite" : "rejected";

    const newPath = await moveImage(
      variant.filePath,
      bucket,
      variant.productId,
      variant.jobId,
      variant.id,
    );

    await metadataStore.updateVariantStatus(variant.id, newStatus);

    return {
      updatedVariant: {
        ...variant,
        status: newStatus,
        filePath: newPath,
      },
      newJobIds: [],
    };
  }

  if (event.action === "hero_lock") {
    if (!event.targetColors || event.targetColors.length === 0) {
      return {
        updatedVariant: variant,
        newJobIds: [],
      };
    }

    const newPath = await moveImage(
      variant.filePath,
      "favorites",
      variant.productId,
      variant.jobId,
      variant.id,
    );

    await metadataStore.updateVariantStatus(variant.id, "hero_lock");
    const updatedVariant: ImageVariant = {
      ...variant,
      status: "hero_lock",
      filePath: newPath,
      heroLockId: variant.id,
    };

    const heroLockResult = await executeHeroLock(
      { ...updatedVariant },
      event.targetColors,
    );

    return {
      updatedVariant,
      newJobIds: [heroLockResult.variantJobId],
      heroLockResult,
    };
  }

  return { updatedVariant: null, newJobIds: [] };
}
