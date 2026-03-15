"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
const nanoid_1 = require("nanoid");
const AURELEA_DEFAULT_OUTFIT = "short Pilates outfit in neutral black";
const AURELEA_DEFAULT_BAREFOOT = true;
const AURELEA_DEFAULT_MAT = "black exercise mat";
function buildPrompt(args) {
    const { workflowType, product, brandRules, references } = args;
    if (workflowType === "AMAZON_LIFESTYLE_SHOT") {
        return buildLifestylePrompt(args);
    }
    // NEUTRAL_PRODUCT_SHOT
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
function buildLifestylePrompt(args) {
    const { product, brandDna, sceneOptions, useGoldenBackground, creativeFreedom, imageLayout = { hasProductRefs: true, hasBackgroundRef: false, hasModelRefs: false } } = args;
    const productName = product.name ?? product.id;
    const dnaBlock = brandDna?.text
        ? `Brand DNA (follow this visual style):\n${brandDna.text}\n\n`
        : `Brand: AuréLéa. Visual style: calm, minimal, feminine, premium; soft natural lighting, warm tones, elegant negative space.\n\n`;
    const imageOrder = [];
    if (imageLayout.hasProductRefs)
        imageOrder.push("product reference(s)");
    if (imageLayout.hasBackgroundRef)
        imageOrder.push("background reference (use this as the scene background)");
    if (imageLayout.hasModelRefs)
        imageOrder.push("model reference(s) (pose and person style)");
    const imageOrderLine = imageOrder.length > 0
        ? `You receive ${imageOrder.length} image group(s) in this order: ${imageOrder.join("; ")}.\n\n`
        : "";
    const outfit = sceneOptions?.outfit ?? AURELEA_DEFAULT_OUTFIT;
    const barefoot = sceneOptions?.barefoot ?? AURELEA_DEFAULT_BAREFOOT;
    const mat = sceneOptions?.mat ?? AURELEA_DEFAULT_MAT;
    const sceneLine = creativeFreedom === true
        ? "Choose a sporty, elegant pose and styling that fits the brand; outfit and setting can vary within the brand DNA.\n\n"
        : `Scene requirements: Model wears ${outfit}, ${barefoot ? "barefoot" : "with appropriate footwear"}, training on a ${mat}. Choose a single sporty, elegant pose (e.g. Pilates exercise) that shows the product in use.\n\n`;
    const backgroundLine = useGoldenBackground && imageLayout.hasBackgroundRef
        ? "Use the provided background reference image as the exact background of the generated scene.\n\n"
        : useGoldenBackground && !imageLayout.hasBackgroundRef
            ? "Use a warm golden / sand-toned background consistent with the brand.\n\n"
            : "Use a calm, minimal background consistent with the brand DNA (soft neutral, warm light).\n\n";
    const taskLine = `Generate exactly one high-quality Amazon-style lifestyle product image: a model performing an exercise or pose with the ${productName}. The product must be clearly visible and recognisable from the reference(s). The image should be suitable for e-commerce (product listing). Output only the generated image, no text.`;
    const text = [
        imageOrderLine,
        dnaBlock,
        sceneLine,
        backgroundLine,
        taskLine
    ].join("");
    return {
        id: (0, nanoid_1.nanoid)(),
        templateId: "amazon_lifestyle_shot_v1",
        templateVersion: 1,
        workflowType: "AMAZON_LIFESTYLE_SHOT",
        text
    };
}
