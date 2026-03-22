import { nanoid } from "nanoid";
import { metadataStore } from "./metadataStore";
import { storeImage } from "./resultStorage";
import { extractSceneLock } from "./sceneExtractor";
import { generateRecolorVariant } from "./recolorGenerator";
import type { ImageVariant } from "../domain/imageVariant";
import type { ImageJob } from "../domain/imageJob";
import type { ProductColorDef } from "../types/api";
import type { SceneLock } from "../domain/sceneLock";
import { buildProductFromId } from "../domain/product";
import { getEnv } from "../config/env";

export interface HeroLockResult {
  heroLockId: string;
  sceneLock: SceneLock;
  variantJobId: string;
  generatedVariants: {
    colorName: string;
    colorHex: string;
    variantId: string;
    status: "completed" | "failed";
    error?: string;
  }[];
  skippedColors: string[];
}

/**
 * Full Hero Lock workflow:
 * 1. Mark the source variant as hero_lock
 * 2. Extract SceneLock (image DNA) via Gemini structured output
 * 3. Filter out any target color matching the detected original
 * 4. Generate a recolor variant for each remaining color
 * 5. Store all variants with lineage metadata
 */
export async function executeHeroLock(
  variant: ImageVariant,
  targetColors: ProductColorDef[],
): Promise<HeroLockResult> {
  const heroLockId = nanoid();
  const env = getEnv();
  const product = buildProductFromId(variant.productId, env.WORKFLOW_DATA_ROOT);

  const job = await metadataStore.getJob(variant.jobId);
  const workflowType = job?.workflowType ?? "UNKNOWN";

  const sceneLock = await extractSceneLock(
    variant.filePath,
    variant.id,
    variant.productId,
    workflowType,
  );

  const detectedLower = (sceneLock.detectedProductColor ?? "").toLowerCase().trim();
  const colorsToGenerate: ProductColorDef[] = [];
  const skippedColors: string[] = [];

  for (const color of targetColors) {
    const nameLower = color.name.toLowerCase().trim();
    if (detectedLower && nameLower === detectedLower) {
      skippedColors.push(color.name);
    } else {
      colorsToGenerate.push(color);
    }
  }

  if (colorsToGenerate.length === 0) {
    console.log(
      `Hero Lock: all ${targetColors.length} target colors match the detected original (${detectedLower}). No variants to generate.`,
    );
  }

  const variantJobId = nanoid();
  const now = new Date().toISOString();
  const variantJob: ImageJob = {
    id: variantJobId,
    productId: variant.productId,
    workflowType: "HERO_LOCK_RECOLOR",
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  await metadataStore.insertJob(variantJob);

  const results: HeroLockResult["generatedVariants"] = [];

  for (const color of colorsToGenerate) {
    const variantId = nanoid();
    try {
      const generated = await generateRecolorVariant({
        masterImagePath: variant.filePath,
        sceneLock,
        targetColorName: color.name,
        targetColorHex: color.hex,
      });

      const filePath = await storeImage({
        product,
        jobId: variantJobId,
        bucket: "neutral",
        imageId: variantId,
        extension: generated.extension,
        buffer: generated.buffer,
      });

      const newVariant: ImageVariant = {
        id: variantId,
        jobId: variantJobId,
        productId: variant.productId,
        status: "neutral",
        filePath,
        colorVariant: color.name,
        createdAt: new Date().toISOString(),
        colorLineage: {
          parentVariantId: variant.id,
          targetColorName: color.name,
          targetColorHex: color.hex,
          generationMethod: "hero_lock_recolor",
        },
      };

      await metadataStore.insertVariant(newVariant);
      results.push({
        colorName: color.name,
        colorHex: color.hex,
        variantId,
        status: "completed",
      });

      console.log(
        `Hero Lock: generated variant for ${color.name} (${color.hex})`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `Hero Lock: failed to generate variant for ${color.name}: ${errorMsg}`,
      );
      results.push({
        colorName: color.name,
        colorHex: color.hex,
        variantId,
        status: "failed",
        error: errorMsg,
      });
    }
  }

  const allSuccess = results.every((r) => r.status === "completed");
  await metadataStore.updateJobStatus(
    variantJobId,
    allSuccess ? "completed" : "failed",
  );

  return {
    heroLockId,
    sceneLock,
    variantJobId,
    generatedVariants: results,
    skippedColors,
  };
}
