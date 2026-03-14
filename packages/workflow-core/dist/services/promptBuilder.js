"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
const nanoid_1 = require("nanoid");
function buildPrompt(args) {
    const { workflowType, product, brandRules, references } = args;
    // Very simple neutral product shot prompt for MVP.
    const brandName = brandRules?.brandName ?? product.name ?? product.id;
    const referenceHint = references.length > 0 ? "Use the provided reference images as guidance." : "No reference images available.";
    const text = [
        `High quality neutral product shot of a ${product.name ?? product.id}.`,
        `Brand: ${brandName}.`,
        "Plain, clean background suitable for ecommerce.",
        referenceHint
    ].join(" ");
    return {
        id: (0, nanoid_1.nanoid)(),
        templateId: "neutral_product_shot_v1",
        templateVersion: 1,
        workflowType,
        text
    };
}
