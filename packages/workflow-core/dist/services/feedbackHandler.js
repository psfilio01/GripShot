"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFeedbackInternal = handleFeedbackInternal;
const metadataStore_1 = require("./metadataStore");
const resultStorage_1 = require("./resultStorage");
async function handleFeedbackInternal(event) {
    const variant = await metadataStore_1.metadataStore.getVariantById(event.imageId);
    if (!variant) {
        return { updatedVariant: null, newJobIds: [] };
    }
    if (event.action === "favorite" || event.action === "reject") {
        const bucket = event.action === "favorite" ? "favorites" : "rejected";
        // Map bucket name (folder) to variant status (domain enum).
        const newStatus = event.action === "favorite" ? "favorite" : "rejected";
        const newPath = await (0, resultStorage_1.moveImage)(variant.filePath, bucket, variant.productId, variant.jobId, variant.id);
        await metadataStore_1.metadataStore.updateVariantStatus(variant.id, newStatus);
        return {
            updatedVariant: {
                ...variant,
                status: newStatus,
                filePath: newPath
            },
            newJobIds: []
        };
    }
    if (event.action === "generate_all_colors") {
        // For MVP we just acknowledge; variant generation will be added later.
        return {
            updatedVariant: variant,
            newJobIds: []
        };
    }
    return { updatedVariant: null, newJobIds: [] };
}
