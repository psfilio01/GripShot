import { nanoid } from "nanoid";
import { getEnv } from "../config/env";
import { buildProductFromId } from "../domain/product";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
import type { ProductColorDef } from "../types/api";
import { extractSceneLock } from "./sceneExtractor";
import {
  isGenerationCancelledError,
  throwIfGenerationCancelled,
  type GenerationControl,
} from "./generationCancellation";
import { generateMainImageVariant } from "./mainImageGenerator";
import { metadataStore } from "./metadataStore";
import { deleteStoredImage, storeImage } from "./resultStorage";

export interface MainImageResultItem {
  colorName: string;
  colorHex?: string;
  variantId: string;
  filePath?: string;
  status: "completed" | "failed";
  error?: string;
}

export interface MainImageResult {
  mainImageId?: string;
  variantJobId: string;
  generatedVariants: MainImageResultItem[];
  skippedColors: string[];
  cancelled?: boolean;
}

/**
 * Creates an Amazon MAIN master on pure white and then derives every
 * configured product color from that master. Visual approval stays with the
 * user; the pipeline deliberately performs no post-generation quality gate.
 */
export async function executeMainImageLock(
  source: ImageVariant,
  targetColors: ProductColorDef[],
  control?: GenerationControl,
): Promise<MainImageResult> {
  const product = buildProductFromId(
    source.productId,
    getEnv().WORKFLOW_DATA_ROOT,
  );
  const sourceJob = await metadataStore.getJob(source.jobId);
  await throwIfGenerationCancelled(control);
  const sceneLock = await extractSceneLock(
    source.filePath,
    source.id,
    source.productId,
    sourceJob?.workflowType ?? "UNKNOWN",
    control?.signal,
  );
  await throwIfGenerationCancelled(control);

  const variantJobId = nanoid();
  const now = new Date().toISOString();
  const job: ImageJob = {
    id: variantJobId,
    productId: source.productId,
    workflowType: "AMAZON_MAIN_IMAGE_VARIANTS",
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  await metadataStore.insertJob(job);

  const results: MainImageResultItem[] = [];
  let mainVariant: ImageVariant | null = null;
  let cancelled = false;

  try {
    const mainImageId = nanoid();
    const generated = await generateMainImageVariant({
      sourceImagePath: source.filePath,
      sceneLock,
      signal: control?.signal,
    });
    await throwIfGenerationCancelled(control);
    const filePath = await storeImage({
      product,
      jobId: variantJobId,
      bucket: "favorites",
      imageId: mainImageId,
      extension: generated.extension,
      buffer: generated.buffer,
    });
    try {
      await throwIfGenerationCancelled(control);
    } catch (error) {
      await deleteStoredImage(filePath);
      throw error;
    }
    mainVariant = {
      id: mainImageId,
      jobId: variantJobId,
      productId: source.productId,
      status: "main_image",
      filePath,
      createdAt: new Date().toISOString(),
      mainImageId,
    };
    await metadataStore.insertVariant(mainVariant);
    results.push({
      colorName: sceneLock.detectedProductColor ?? "Original",
      variantId: mainImageId,
      filePath,
      status: "completed",
    });

    const detected = (sceneLock.detectedProductColor ?? "").toLowerCase().trim();
    const skippedColors: string[] = [];
    for (const color of targetColors) {
      if (detected && color.name.toLowerCase().trim() === detected) {
        skippedColors.push(color.name);
        continue;
      }
      const variantId = nanoid();
      try {
        await throwIfGenerationCancelled(control);
        const colorImage = await generateMainImageVariant({
          sourceImagePath: mainVariant.filePath,
          sceneLock: {
            ...sceneLock,
            sourceAssetId: mainImageId,
            backgroundNotes: "Uniform pure white #FFFFFF Amazon MAIN background",
          },
          targetColorName: color.name,
          targetColorHex: color.hex,
          signal: control?.signal,
        });
        await throwIfGenerationCancelled(control);
        const colorPath = await storeImage({
          product,
          jobId: variantJobId,
          bucket: "neutral",
          imageId: variantId,
          extension: colorImage.extension,
          buffer: colorImage.buffer,
        });
        try {
          await throwIfGenerationCancelled(control);
        } catch (error) {
          await deleteStoredImage(colorPath);
          throw error;
        }
        const variant: ImageVariant = {
          id: variantId,
          jobId: variantJobId,
          productId: source.productId,
          status: "neutral",
          filePath: colorPath,
          colorVariant: color.name,
          createdAt: new Date().toISOString(),
          mainImageId,
          colorLineage: {
            parentVariantId: mainImageId,
            targetColorName: color.name,
            targetColorHex: color.hex,
            generationMethod: "main_image_recolor",
          },
        };
        await metadataStore.insertVariant(variant);
        results.push({
          colorName: color.name,
          colorHex: color.hex,
          variantId,
          filePath: colorPath,
          status: "completed",
        });
      } catch (error) {
        if (isGenerationCancelledError(error)) {
          cancelled = true;
          break;
        }
        results.push({
          colorName: color.name,
          colorHex: color.hex,
          variantId,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const allSuccess = results.every((result) => result.status === "completed");
    await metadataStore.updateJobStatus(
      variantJobId,
      cancelled ? "cancelled" : allSuccess ? "completed" : "failed",
    );
    return {
      mainImageId,
      variantJobId,
      generatedVariants: results,
      skippedColors,
      ...(cancelled ? { cancelled: true } : {}),
    };
  } catch (error) {
    await metadataStore.updateJobStatus(
      variantJobId,
      isGenerationCancelledError(error) ? "cancelled" : "failed",
    );
    throw error;
  }
}
