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
const promptBuilder_1 = require("../services/promptBuilder");
const imageGenerator_1 = require("../services/imageGenerator");
const resultStorage_1 = require("../services/resultStorage");
const metadataStore_1 = require("../services/metadataStore");
const feedbackHandler_1 = require("../services/feedbackHandler");
async function startImageJob(input) {
    const env = (0, env_1.getEnv)();
    const product = (0, product_1.buildProductFromId)(input.productId, env.WORKFLOW_DATA_ROOT);
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
        const brandRules = await (0, brandRuleLoader_1.loadBrandRules)(product);
        const prompt = (0, promptBuilder_1.buildPrompt)({
            workflowType: input.workflowType,
            product,
            brandRules,
            references
        });
        if (references.length === 0) {
            throw new Error(`No reference images found for product ${product.id}. At least one reference is required for Nano Banana editing.`);
        }
        // For MVP, use the first reference image as the base for editing.
        const baseReference = references[0];
        const generatedImages = await (0, imageGenerator_1.generateImagesWithNanoBanana)(prompt, baseReference.path);
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
        return {
            jobId,
            status: "completed"
        };
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
