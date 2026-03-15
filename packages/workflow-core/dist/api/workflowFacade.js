"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startImageJob = startImageJob;
exports.getJob = getJob;
exports.handleFeedback = handleFeedback;
const nanoid_1 = require("nanoid");
const env_1 = require("../config/env");
const product_1 = require("../domain/product");
const referenceImageLoader_1 = require("../services/referenceImageLoader");
const brandRuleLoader_1 = require("../services/brandRuleLoader");
const brandDnaLoader_1 = require("../services/brandDnaLoader");
const modelLoader_1 = require("../services/modelLoader");
const backgroundLoader_1 = require("../services/backgroundLoader");
const runtimeInputLoader_1 = require("../services/runtimeInputLoader");
const hardRulesLoader_1 = require("../services/hardRulesLoader");
const promptBuilder_1 = require("../services/promptBuilder");
const imageGenerator_1 = require("../services/imageGenerator");
const resultStorage_1 = require("../services/resultStorage");
const metadataStore_1 = require("../services/metadataStore");
const feedbackHandler_1 = require("../services/feedbackHandler");
/** Randomly pick between 1 and maxCount items from array (or all if array is smaller). */
function pickRandomSubset(arr, maxCount) {
    if (arr.length === 0)
        return [];
    const count = Math.min(arr.length, Math.max(1, Math.floor(Math.random() * maxCount) + 1));
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}
async function startImageJob(input) {
    const env = (0, env_1.getEnv)();
    const dataRoot = env.WORKFLOW_DATA_ROOT;
    const product = (0, product_1.buildProductFromId)(input.productId, dataRoot);
    const jobId = (0, nanoid_1.nanoid)();
    const now = new Date().toISOString();
    const job = {
        id: jobId,
        productId: product.id,
        workflowType: input.workflowType,
        status: "running",
        createdAt: now,
        updatedAt: now
    };
    await metadataStore_1.metadataStore.insertJob(job);
    try {
        const references = await (0, referenceImageLoader_1.loadReferenceImages)(product);
        if (references.length === 0) {
            throw new Error(`No reference images found for product ${product.id}. At least one reference is required.`);
        }
        const brandRules = await (0, brandRuleLoader_1.loadBrandRules)(product);
        // Grip Shot layers: runtime input + hard rules (loaded for all workflow types)
        const runtimeInput = await (0, runtimeInputLoader_1.loadRuntimeInput)(dataRoot);
        const globalHardRules = await (0, hardRulesLoader_1.loadGlobalHardRules)(dataRoot);
        const productHardRules = await (0, hardRulesLoader_1.loadProductHardRules)(product);
        if (runtimeInput) {
            console.log("Grip Shot: runtime input loaded", Object.keys(runtimeInput));
        }
        let prompt;
        let referencePaths;
        if (input.workflowType === "AMAZON_LIFESTYLE_SHOT") {
            const brandDna = await (0, brandDnaLoader_1.loadBrandDna)(dataRoot);
            const useGoldenBackground = input.useGoldenBackground === true;
            const goldenBg = useGoldenBackground ? await (0, backgroundLoader_1.loadGoldenBackground)(dataRoot) : null;
            const modelIds = await (0, modelLoader_1.listModels)(dataRoot);
            const chosenModelId = input.modelId ?? (0, modelLoader_1.pickRandomModelId)(modelIds);
            const modelRefs = chosenModelId ? await (0, modelLoader_1.loadModelReferences)(dataRoot, chosenModelId) : [];
            const maxProductRefs = 3;
            const selectedProductRefs = pickRandomSubset(references, maxProductRefs);
            const productPaths = selectedProductRefs.map((r) => r.path);
            const imagePaths = [...productPaths];
            if (goldenBg)
                imagePaths.push(goldenBg.path);
            modelRefs.forEach((r) => imagePaths.push(r.path));
            const hasModelRefs = modelRefs.length > 0;
            const hasBackgroundRef = goldenBg != null;
            prompt = (0, promptBuilder_1.buildPrompt)({
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
        }
        else {
            const baseReference = references[0];
            prompt = (0, promptBuilder_1.buildPrompt)({
                workflowType: input.workflowType,
                product,
                brandRules,
                references,
                runtimeInput,
                globalHardRules,
                productHardRules
            });
            referencePaths = [baseReference.path];
        }
        const generatedImages = await (0, imageGenerator_1.generateImagesWithNanoBanana)(prompt, referencePaths);
        const variants = [];
        for (const generated of generatedImages) {
            const imageId = (0, nanoid_1.nanoid)();
            const filePath = await (0, resultStorage_1.storeImage)({
                product,
                jobId,
                bucket: "neutral",
                imageId,
                extension: generated.extension,
                buffer: generated.buffer
            });
            const variant = {
                id: imageId,
                jobId,
                productId: product.id,
                status: "neutral",
                filePath,
                colorVariant: null,
                createdAt: new Date().toISOString()
            };
            await metadataStore_1.metadataStore.insertVariant(variant);
            variants.push(variant);
        }
        await metadataStore_1.metadataStore.updateJobStatus(jobId, "completed");
        return { jobId, status: "completed" };
    }
    catch (err) {
        await metadataStore_1.metadataStore.updateJobStatus(jobId, "failed");
        throw err;
    }
}
async function getJob(jobId) {
    const job = await metadataStore_1.metadataStore.getJob(jobId);
    if (!job) {
        return {
            jobId,
            status: "failed",
            images: []
        };
    }
    const variants = await metadataStore_1.metadataStore.listVariantsForJob(jobId);
    const images = variants.map((v) => ({
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
async function handleFeedback(event) {
    const result = await (0, feedbackHandler_1.handleFeedbackInternal)(event);
    let updatedImage = null;
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
