import { deletePendingImageGeneration, failPendingImageGeneration, isPendingImageGenerationCancelled } from "@/lib/db/pending-image-generations";
import { getProduct } from "@/lib/db/products";
import { cancelRegisteredGeneration, registerGenerationCancellation, releaseGenerationCancellation } from "@/lib/generation/cancellation-registry";

export interface RunPendingMainImageInput {
  workspaceId: string;
  requestId: string;
  sourceImageId: string;
  productId: string;
  preserveShadow: boolean;
}

/** Main compositing is CPU-only: intentionally no quota check or credit consumption. */
export async function runPendingMainImage(input: RunPendingMainImageInput): Promise<void> {
  const signal = registerGenerationCancellation(input.workspaceId, input.requestId);
  let core: typeof import("@fashionmentum/workflow-core");
  try {
    core = await import("@fashionmentum/workflow-core");
  } catch (error) {
    await failPendingImageGeneration(input.workspaceId, input.requestId, error instanceof Error ? error.message : String(error)).catch(() => {});
    releaseGenerationCancellation(input.workspaceId, input.requestId);
    return;
  }
  const { createMainImage, metadataStore, isGenerationCancelledError } = core;
  const isCancelled = async () => {
    if (signal.aborted || await isPendingImageGenerationCancelled(input.workspaceId, input.requestId)) return true;
    const source = await metadataStore.getVariantById(input.sourceImageId);
    if (!source || source.productId !== input.productId) return true;
    const product = await getProduct(input.workspaceId, input.productId);
    return !product || !!product.deletedAt;
  };
  let checking = false;
  let cancellationCheckFailed = false;
  const interval = setInterval(() => {
    if (checking) return;
    checking = true;
    isCancelled().then((cancelled) => {
      if (cancelled) cancelRegisteredGeneration(input.workspaceId, input.requestId);
    }).catch(() => {
      cancellationCheckFailed = true;
      cancelRegisteredGeneration(input.workspaceId, input.requestId);
    }).finally(() => { checking = false; });
  }, 2000);
  try {
    if (await isCancelled()) {
      await deletePendingImageGeneration(input.workspaceId, input.requestId);
      return;
    }
    await createMainImage(input.sourceImageId, input.preserveShadow, { signal, isCancelled });
    await deletePendingImageGeneration(input.workspaceId, input.requestId);
  } catch (error) {
    if (cancellationCheckFailed) {
      await failPendingImageGeneration(input.workspaceId, input.requestId, "Main-image processing stopped because permission/cancellation checks failed. Please try again.").catch(() => {});
      return;
    }
    if (signal.aborted || isGenerationCancelledError(error) || await isCancelled().catch(() => false)) {
      await deletePendingImageGeneration(input.workspaceId, input.requestId).catch(() => {});
      return;
    }
    await failPendingImageGeneration(input.workspaceId, input.requestId, error instanceof Error ? error.message : String(error)).catch(() => {});
  } finally {
    clearInterval(interval);
    releaseGenerationCancellation(input.workspaceId, input.requestId);
  }
}
