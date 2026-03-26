import { metadataStore } from "./metadataStore";
import { moveImage } from "./resultStorage";
import type { FeedbackEvent } from "../types/api";
import type { ImageVariant } from "../domain/imageVariant";

interface HandleFeedbackInternalResult {
  updatedVariant: ImageVariant | null;
  newJobIds: string[];
}

/**
 * Marks the variant as Hero master (moves to favorites, status hero_lock).
 * Color-variant generation is started separately (e.g. web API uses `after()` + `executeHeroLock`).
 */
export async function prepareHeroLockMaster(
  event: FeedbackEvent,
): Promise<ImageVariant | null> {
  if (event.action !== "hero_lock") return null;
  if (!event.targetColors || event.targetColors.length === 0) return null;

  const variant = await metadataStore.getVariantById(event.imageId);
  if (!variant) return null;

  const newPath = await moveImage(
    variant.filePath,
    "favorites",
    variant.productId,
    variant.jobId,
    variant.id,
  );

  await metadataStore.updateVariantStatus(variant.id, "hero_lock", newPath);
  return {
    ...variant,
    status: "hero_lock",
    filePath: newPath,
    heroLockId: variant.id,
  };
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

    await metadataStore.updateVariantStatus(variant.id, newStatus, newPath);

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
    const updatedVariant = await prepareHeroLockMaster(event);
    return {
      updatedVariant,
      newJobIds: [],
    };
  }

  return { updatedVariant: null, newJobIds: [] };
}
