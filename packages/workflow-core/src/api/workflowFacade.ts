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
import { loadBrandDna } from "../services/brandDnaLoader";
import {
  listModels,
  loadModelReferences,
  resolveChosenModelId,
} from "../services/modelLoader";
import { loadGoldenBackground, loadUserBackground } from "../services/backgroundLoader";
import { loadRuntimeInput } from "../services/runtimeInputLoader";
import { loadGlobalHardRules, loadProductHardRules } from "../services/hardRulesLoader";
import { buildPrompt } from "../services/promptBuilder";
import { generateImagesWithNanoBanana } from "../services/imageGenerator";
import { storeImage } from "../services/resultStorage";
import { metadataStore } from "../services/metadataStore";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
import { handleFeedbackInternal } from "../services/feedbackHandler";

/** Randomly pick between 1 and maxCount items from array (or all if array is smaller). */
function pickRandomSubset<T>(arr: T[], maxCount: number): T[] {
  if (arr.length === 0) return [];
  const count = Math.min(arr.length, Math.max(1, Math.floor(Math.random() * maxCount) + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function startImageJob(input: StartImageJobInput): Promise<StartImageJobResult> {
  const env = getEnv();
  const dataRoot = env.WORKFLOW_DATA_ROOT;
  const product = buildProductFromId(input.productId, dataRoot);

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
    if (references.length === 0) {
      throw new Error(
        `No reference images found for product ${product.id}. At least one reference is required.`
      );
    }

    const brandRules = await loadBrandRules(product);

    // Grip Shot layers: runtime input + hard rules + generation settings
    const { input: runtimeInput, generationSettings } = await loadRuntimeInput(dataRoot);
    const globalHardRules = await loadGlobalHardRules(dataRoot);
    const productHardRules = await loadProductHardRules(product);

    if (input.aspectRatio) {
      generationSettings.aspectRatio = input.aspectRatio as typeof generationSettings.aspectRatio;
    }
    if (input.resolution) {
      generationSettings.resolution = input.resolution as typeof generationSettings.resolution;
    }

    console.log(`\x1b[36m[workflow-core]\x1b[0m Generation settings: ${generationSettings.resolution} @ ${generationSettings.aspectRatio}`);
    if (runtimeInput) {
      console.log(`\x1b[36m[workflow-core]\x1b[0m Runtime input keys: ${Object.keys(runtimeInput).join(", ")}`);
    }

    let prompt;
    let referencePaths: string[];

    if (input.workflowType === "AMAZON_LIFESTYLE_SHOT") {
      const brandDna = await loadBrandDna(dataRoot);

      // Background: user-managed backgroundId takes precedence over legacy golden toggle
      let bgRef: { path: string } | null = null;
      let useGoldenBackground = false;
      if (input.backgroundId) {
        bgRef = await loadUserBackground(dataRoot, input.backgroundId);
        if (bgRef) {
          console.log(`\x1b[36m[workflow-core]\x1b[0m Using user background: ${input.backgroundId}`);
        }
      } else if (input.useGoldenBackground === true) {
        useGoldenBackground = true;
        bgRef = await loadGoldenBackground(dataRoot);
      }

      const filesystemModelIds = await listModels(dataRoot);
      const chosenModelId = resolveChosenModelId(
        input.modelId,
        input.allowedModelIds,
        filesystemModelIds,
      );
      const modelRefs = chosenModelId ? await loadModelReferences(dataRoot, chosenModelId) : [];

      const maxProductRefs = 3;
      const selectedProductRefs = pickRandomSubset(references, maxProductRefs);
      const productPaths = selectedProductRefs.map((r) => r.path);

      const imagePaths: string[] = [...productPaths];
      if (bgRef) imagePaths.push(bgRef.path);
      modelRefs.forEach((r) => imagePaths.push(r.path));

      const hasModelRefs = modelRefs.length > 0;
      const hasBackgroundRef = bgRef != null;
      prompt = buildPrompt({
        workflowType: "AMAZON_LIFESTYLE_SHOT",
        product,
        brandRules,
        references: selectedProductRefs,
        brandDna: brandDna.text ? brandDna : null,
        sceneOptions: input.sceneOptions,
        useGoldenBackground,
        creativeFreedom: input.creativeFreedom,
        imageLayout: {
          hasProductRefs: true,
          hasBackgroundRef,
          hasModelRefs
        },
        runtimeInput,
        globalHardRules,
        productHardRules
      });
      referencePaths = imagePaths;

      console.log(`\x1b[36m[workflow-core]\x1b[0m Lifestyle prompt template: ${prompt.templateId} v${prompt.templateVersion}`);
      console.log(`\x1b[36m[workflow-core]\x1b[0m Reference images: ${referencePaths.length} (product: ${productPaths.length}, bg: ${hasBackgroundRef ? 1 : 0}, model: ${modelRefs.length})`);
      console.log(`\x1b[36m[workflow-core]\x1b[0m \x1b[1m── FULL PROMPT ──\x1b[0m\n${prompt.text}\n\x1b[36m[workflow-core]\x1b[0m \x1b[1m── END PROMPT ──\x1b[0m`);
    } else {
      const baseReference = references[0];
      prompt = buildPrompt({
        workflowType: input.workflowType,
        product,
        brandRules,
        references,
        runtimeInput,
        globalHardRules,
        productHardRules
      });
      referencePaths = [baseReference.path];

      console.log(`\x1b[36m[workflow-core]\x1b[0m Neutral prompt template: ${prompt.templateId} v${prompt.templateVersion}`);
      console.log(`\x1b[36m[workflow-core]\x1b[0m \x1b[1m── FULL PROMPT ──\x1b[0m\n${prompt.text}\n\x1b[36m[workflow-core]\x1b[0m \x1b[1m── END PROMPT ──\x1b[0m`);
    }

    const generatedImages = await generateImagesWithNanoBanana(prompt, referencePaths, generationSettings);

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
      status: "completed",
      promptText: prompt.text,
      referenceImageCount: referencePaths.length,
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
    colorVariant: v.colorVariant ?? undefined,
    heroLockId: v.heroLockId,
    colorLineage: v.colorLineage,
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

