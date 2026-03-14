import { metadataStore } from "./metadataStore";
import { moveImage } from "./resultStorage";
import type { FeedbackEvent } from "../types/api";
import type { ImageVariant } from "../domain/imageVariant";

interface HandleFeedbackInternalResult {
  updatedVariant: ImageVariant | null;
  // Placeholder for future color variant job IDs.
  newJobIds: string[];
}

export async function handleFeedbackInternal(event: FeedbackEvent): Promise<HandleFeedbackInternalResult> {
  const variant = await metadataStore.getVariantById(event.imageId);
  if (!variant) {
    return { updatedVariant: null, newJobIds: [] };
  }

  if (event.action === "favorite" || event.action === "reject") {
    const bucket = event.action === "favorite" ? "favorites" : "rejected";
    // Map bucket name (folder) to variant status (domain enum).
    const newStatus: ImageVariant["status"] = event.action === "favorite" ? "favorite" : "rejected";

    const newPath = await moveImage(
      variant.filePath,
      bucket,
      variant.productId,
      variant.jobId,
      variant.id
    );

    await metadataStore.updateVariantStatus(variant.id, newStatus);

    return {
      updatedVariant: {
        ...variant,
        status: newStatus,
        filePath: newPath
      },
      newJobIds: []
    };
  }

  if (event.action === "generate_all_colors") {
    // For MVP we just acknowledge; variant generation will be added later.
    return {
      updatedVariant: variant,
      newJobIds: []
    };
  }

  return { updatedVariant: null, newJobIds: [] };
}
