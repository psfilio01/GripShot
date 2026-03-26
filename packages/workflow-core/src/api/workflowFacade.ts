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
import { scoreImageQuality } from "../services/qualityScorer";
import { storeImage } from "../services/resultStorage";
import { metadataStore } from "../services/metadataStore";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
import { handleFeedbackInternal } from "../services/feedbackHandler";

const USES_MODEL_REFS = new Set(["AMAZON_LIFESTYLE_SHOT", "LIFESTYLE"]);
const USES_BACKGROUND = new Set(["AMAZON_LIFESTYLE_SHOT", "LIFESTYLE", "A_PLUS_VISUAL"]);

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
  const product = buildProductFromId(
    input.productId,
    dataRoot,
    input.productCategory,
  );

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
    // ── Common loading (all workflow types) ──────────────────────────
    const references = await loadReferenceImages(product);
    if (references.length === 0) {
      throw new Error(
        `No reference images found for product ${product.id}. At least one reference is required.`
      );
    }

    const brandRules = await loadBrandRules(product);
    const brandDna = await loadBrandDna(dataRoot);
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
    if (input.productCategory?.trim()) {
      console.log(
        `\x1b[36m[workflow-core]\x1b[0m Product category input="${input.productCategory}" prompts=${product.category ?? "generic"}`,
      );
    }

    // ── Multiple product refs for ALL types ──────────────────────────
    const maxProductRefs = 3;
    const selectedProductRefs = pickRandomSubset(references, maxProductRefs);
    const productPaths = selectedProductRefs.map((r) => r.path);
    const imagePaths: string[] = [...productPaths];

    // ── Background (lifestyle + A+ visual) ───────────────────────────
    let bgRef: { path: string } | null = null;
    let useGoldenBackground = false;
    if (USES_BACKGROUND.has(input.workflowType)) {
      if (input.backgroundId) {
        bgRef = await loadUserBackground(dataRoot, input.backgroundId);
        if (bgRef) {
          console.log(`\x1b[36m[workflow-core]\x1b[0m Using user background: ${input.backgroundId}`);
        }
      } else if (input.useGoldenBackground === true) {
        useGoldenBackground = true;
        bgRef = await loadGoldenBackground(dataRoot);
      }
      if (bgRef) imagePaths.push(bgRef.path);
    }

    // ── Human model refs (lifestyle only) ────────────────────────────
    let modelRefs: { path: string }[] = [];
    if (USES_MODEL_REFS.has(input.workflowType)) {
      const filesystemModelIds = await listModels(dataRoot);
      const chosenModelId = resolveChosenModelId(
        input.modelId,
        input.allowedModelIds,
        filesystemModelIds,
      );
      modelRefs = chosenModelId ? await loadModelReferences(dataRoot, chosenModelId) : [];
      modelRefs.forEach((r) => imagePaths.push(r.path));
    }

    const hasBackgroundRef = bgRef != null;
    const hasModelRefs = modelRefs.length > 0;

    // ── Build prompt (all context available to every type) ───────────
    const prompt = buildPrompt({
      workflowType: input.workflowType,
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
        hasModelRefs,
      },
      runtimeInput,
      globalHardRules,
      productHardRules,
      userPromptBlock: input.userPromptBlock,
      poseDescription: input.poseDescription,
    });

    const referencePaths = imagePaths;

    console.log(`\x1b[36m[workflow-core]\x1b[0m Prompt template: ${prompt.templateId} v${prompt.templateVersion} [${input.workflowType}]`);
    console.log(`\x1b[36m[workflow-core]\x1b[0m Reference images: ${referencePaths.length} (product: ${productPaths.length}, bg: ${hasBackgroundRef ? 1 : 0}, model: ${modelRefs.length})`);
    console.log(`\x1b[36m[workflow-core]\x1b[0m \x1b[1m── FULL PROMPT ──\x1b[0m\n${prompt.text}\n\x1b[36m[workflow-core]\x1b[0m \x1b[1m── END PROMPT ──\x1b[0m`);

    // ── Generate images ──────────────────────────────────────────────
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

    // ── Quality scoring (opt-in) ─────────────────────────────────────
    if (input.scoreQuality) {
      console.log(`\x1b[36m[workflow-core]\x1b[0m Running quality scoring on ${variants.length} image(s)…`);
      for (const variant of variants) {
        try {
          const score = await scoreImageQuality({
            imagePath: variant.filePath,
            workflowType: input.workflowType,
            productCategory: product.category,
            productName: product.name,
          });
          variant.qualityScore = score;
          await metadataStore.updateVariantQualityScore(variant.id, score);
          console.log(`\x1b[36m[workflow-core]\x1b[0m Quality score for ${variant.id}: ${score.overallScore}/10`);
        } catch (scoreErr) {
          console.error(`\x1b[33m[workflow-core]\x1b[0m Quality scoring failed for ${variant.id}, skipping:`, scoreErr);
        }
      }
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
    qualityScore: v.qualityScore,
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

