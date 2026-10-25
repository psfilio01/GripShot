import { nanoid } from "nanoid";
import { getEnv } from "../config/env";
import { buildProductFromId } from "../domain/product";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
import { metadataStore } from "./metadataStore";
import { storeImage } from "./resultStorage";

export interface RegisterExternalHeroMasterInput {
  productId: string;
  buffer: Buffer;
  extension: "jpg" | "png" | "webp";
  mode?: "hero" | "main";
}

/**
 * Persists a user-uploaded image as a Hero master or a temporary Main source
 * so both flows can use the existing Scene Lock and recolor pipeline.
 */
export async function registerExternalHeroMaster(
  input: RegisterExternalHeroMasterInput,
): Promise<ImageVariant> {
  const now = new Date().toISOString();
  const jobId = nanoid();
  const imageId = nanoid();
  const product = buildProductFromId(
    input.productId,
    getEnv().WORKFLOW_DATA_ROOT,
  );

  const job: ImageJob = {
    id: jobId,
    productId: input.productId,
    workflowType: "EXTERNAL_HERO_UPLOAD",
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  await metadataStore.insertJob(job);

  try {
    const filePath = await storeImage({
      product,
      jobId,
      bucket: "favorites",
      imageId,
      extension: input.extension,
      buffer: input.buffer,
    });

    const variant: ImageVariant = {
      id: imageId,
      jobId,
      productId: input.productId,
      status: input.mode === "main" ? "main_source" : "hero_lock",
      filePath,
      createdAt: now,
      ...(input.mode === "main"
        ? { temporarySource: true }
        : { heroLockId: imageId }),
    };
    await metadataStore.insertVariant(variant);
    await metadataStore.updateJobStatus(jobId, "completed");
    return variant;
  } catch (error) {
    await metadataStore.updateJobStatus(jobId, "failed");
    throw error;
  }
}
