import { nanoid } from "nanoid";
import type {
  StartImageJobInput,
  StartImageJobResult,
  GetJobResult,
  FeedbackEvent,
  HandleFeedbackResult,
  GetJobResultImage
} from "../types/api";
import { getEnv } from "../config/env";
import { buildProductFromId } from "../domain/product";
import { loadReferenceImages } from "../services/referenceImageLoader";
import { loadBrandRules } from "../services/brandRuleLoader";
import { buildPrompt } from "../services/promptBuilder";
import { generateImagesWithNanoBanana } from "../services/imageGenerator";
import { storeImage } from "../services/resultStorage";
import { metadataStore } from "../services/metadataStore";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
import { handleFeedbackInternal } from "../services/feedbackHandler";

export async function startImageJob(input: StartImageJobInput): Promise<StartImageJobResult> {
  const env = getEnv();
  const product = buildProductFromId(input.productId, env.WORKFLOW_DATA_ROOT);

  const jobId = nanoid();
  const now = new Date().toISOString();

  const job: ImageJob = {
    id: jobId,
    productId: product.id,
    workflowType: input.workflowType,
    status: "running",
    createdAt: now,
    updatedAt: now
  };

  await metadataStore.insertJob(job);

  try {
    const references = await loadReferenceImages(product);
    const brandRules = await loadBrandRules(product);
    const prompt = buildPrompt({
      workflowType: input.workflowType,
      product,
      brandRules,
      references
    });

    if (references.length === 0) {
      throw new Error(
        `No reference images found for product ${product.id}. At least one reference is required for Nano Banana editing.`
      );
    }

    // For MVP, use the first reference image as the base for editing.
    const baseReference = references[0];

    const generatedImages = await generateImagesWithNanoBanana(prompt, baseReference.path);

    const variants: ImageVariant[] = [];

    for (const generated of generatedImages) {
      const imageId = nanoid();
      const filePath = await storeImage({
        product,
        jobId,
        bucket: "neutral",
        imageId,
        extension: generated.extension,
        buffer: generated.buffer
      });

      const variant: ImageVariant = {
        id: imageId,
        jobId,
        productId: product.id,
        status: "neutral",
        filePath,
        colorVariant: null,
        createdAt: new Date().toISOString()
      };

      await metadataStore.insertVariant(variant);
      variants.push(variant);
    }

    await metadataStore.updateJobStatus(jobId, "completed");

    return {
      jobId,
      status: "completed"
    };
  } catch (err) {
    await metadataStore.updateJobStatus(jobId, "failed");
    throw err;
  }
}

export async function getJob(jobId: string): Promise<GetJobResult> {
  const job = await metadataStore.getJob(jobId);
  if (!job) {
    return {
      jobId,
      status: "failed",
      images: []
    };
  }

  const variants = await metadataStore.listVariantsForJob(jobId);

  const images: GetJobResultImage[] = variants.map((v) => ({
    imageId: v.id,
    status: v.status,
    filePath: v.filePath,
    colorVariant: v.colorVariant ?? undefined
  }));

  return {
    jobId: job.id,
    status: job.status,
    images
  };
}

export async function handleFeedback(event: FeedbackEvent): Promise<HandleFeedbackResult> {
  const result = await handleFeedbackInternal(event);

  let updatedImage: GetJobResultImage | null = null;
  if (result.updatedVariant) {
    updatedImage = {
      imageId: result.updatedVariant.id,
      status: result.updatedVariant.status,
      filePath: result.updatedVariant.filePath,
      colorVariant: result.updatedVariant.colorVariant ?? undefined
    };
  }

  return {
    updatedImage,
    newJobIds: result.newJobIds
  };
}

