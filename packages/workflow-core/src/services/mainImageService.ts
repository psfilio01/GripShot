import { nanoid } from "nanoid";
import { getEnv } from "../config/env";
import { buildProductFromId } from "../domain/product";
import type { ImageVariant } from "../domain/imageVariant";
import { metadataStore } from "./metadataStore";
import { readImageFileForProcessing } from "./imageFileRead";
import { deleteStoredImage, storeImage } from "./resultStorage";
import { runMainImageWorker } from "./mainImageWorker";
import { GenerationCancelledError, isGenerationCancelledError, throwIfGenerationCancelled, type GenerationControl } from "./generationCancellation";

/** CPU-only, independent Main copy; does not call a generative model or alter source pixels/files. */
export async function createMainImage(sourceImageId: string, preserveShadow = true, control?: GenerationControl): Promise<ImageVariant> {
  await throwIfGenerationCancelled(control);
  const source = await metadataStore.getVariantById(sourceImageId);
  if (!source || source.mainImage) throw new Error("Choose an existing original or color image, not another Main copy.");
  const { buffer } = await readImageFileForProcessing(source.filePath);
  const jobId = nanoid();
  const imageId = nanoid();
  const now = new Date().toISOString();
  await metadataStore.insertJob({ id: jobId, productId: source.productId, workflowType: "MAIN_WHITE_BACKGROUND", status: "running", createdAt: now, updatedAt: now });
  let storedPath: string | undefined;
  let inserted = false;
  try {
    const output = await runMainImageWorker(buffer, preserveShadow, control);
    await throwIfGenerationCancelled(control);
    if (!(await metadataStore.getVariantById(sourceImageId))) throw new GenerationCancelledError();
    storedPath = await storeImage({ product: buildProductFromId(source.productId, getEnv().WORKFLOW_DATA_ROOT), jobId, imageId, bucket: "neutral", extension: "png", buffer: output.buffer });
    await throwIfGenerationCancelled(control);
    // Deleting a Hero while its copy was being prepared must not resurrect a result.
    if (!(await metadataStore.getVariantById(sourceImageId))) throw new GenerationCancelledError();
    const variant: ImageVariant = {
      id: imageId, jobId, productId: source.productId, status: "neutral", filePath: storedPath, createdAt: new Date().toISOString(),
      colorVariant: source.colorVariant,
      mainImage: { sourceVariantId: sourceImageId, sourceSha256: output.sourceSha256, preserveShadow, reviewed: false, metrics: output.metrics },
    };
    await metadataStore.insertVariant(variant);
    inserted = true;
    await throwIfGenerationCancelled(control);
    await metadataStore.updateJobStatus(jobId, "completed");
    return variant;
  } catch (error) {
    if (inserted) await metadataStore.deleteVariantsByIds([imageId]);
    if (storedPath) await deleteStoredImage(storedPath).catch(() => {});
    await metadataStore.updateJobStatus(jobId, isGenerationCancelledError(error) ? "cancelled" : "failed");
    throw error;
  }
}

/** Only removes this derived Main file. Its Hero/color source is never cascaded. */
export async function deleteMainImage(imageId: string): Promise<boolean> {
  const variant = await metadataStore.getVariantById(imageId);
  if (!variant?.mainImage) return false;
  await deleteStoredImage(variant.filePath);
  await metadataStore.deleteVariantsByIds([imageId]);
  return true;
}
