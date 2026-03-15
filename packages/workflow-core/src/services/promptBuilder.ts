import { nanoid } from "nanoid";
import type { WorkflowType } from "../types/api";
import type { SceneOptions } from "../types/api";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";
import type { ReferenceImage } from "./referenceImageLoader";
import type { BuiltPrompt } from "../domain/prompt";
import type { BrandDna } from "./brandDnaLoader";
import type { RuntimeInput } from "./runtimeInputLoader";
import type { HardRules } from "./hardRulesLoader";

export interface BuildPromptArgs {
  workflowType: WorkflowType;
  product: Product;
  brandRules: BrandRules | null;
  references: ReferenceImage[];
  brandDna?: BrandDna | null;
  sceneOptions?: SceneOptions;
  useGoldenBackground?: boolean;
  creativeFreedom?: boolean;
  imageLayout?: { hasProductRefs: boolean; hasBackgroundRef: boolean; hasModelRefs: boolean };
  /** Runtime creative input from OpenClaw / run_input.json. */
  runtimeInput?: RuntimeInput | null;
  /** Global brand hard rules. */
  globalHardRules?: HardRules | null;
  /** Product-specific hard rules. */
  productHardRules?: HardRules | null;
}

const AURELEA_DEFAULT_OUTFIT = "short Pilates outfit in neutral black";
const AURELEA_DEFAULT_BAREFOOT = true;
const AURELEA_DEFAULT_MAT = "black exercise mat";

export function buildPrompt(args: BuildPromptArgs): BuiltPrompt {
  const { workflowType, product, brandRules, references } = args;

  if (workflowType === "AMAZON_LIFESTYLE_SHOT") {
    return buildLifestylePrompt(args);
  }

  // NEUTRAL_PRODUCT_SHOT (unchanged)
  const brandName = brandRules?.brandName ?? product.name ?? product.id;
  const referenceHint =
    references.length > 0 ? "Use the provided reference images as guidance." : "No reference images available.";
  const text = [
    `High quality neutral product shot of a ${product.name ?? product.id}.`,
    `Brand: ${brandName}.`,
    "Plain, clean background suitable for ecommerce.",
    referenceHint
  ].join(" ");

  return {
    id: nanoid(),
    templateId: "neutral_product_shot_v1",
    templateVersion: 1,
    workflowType,
    text
  };
}

// ---------------------------------------------------------------------------
// Layered Lifestyle Prompt Assembly
//
// Layer 1: Defaults (hardcoded AuréLéa style + brand DNA file)
// Layer 2: Runtime JSON (creative overrides from OpenClaw)
// Layer 3: Global hard rules (brand guardrails)
// Layer 4: Product hard rules (product-specific constraints)
// ---------------------------------------------------------------------------

function buildLifestylePrompt(args: BuildPromptArgs): BuiltPrompt {
  const {
    product,
    brandDna,
    sceneOptions,
    useGoldenBackground,
    creativeFreedom,
    imageLayout = { hasProductRefs: true, hasBackgroundRef: false, hasModelRefs: false },
    runtimeInput,
    globalHardRules,
    productHardRules
  } = args;

  const productName = product.name ?? product.id;
  const blocks: string[] = [];

  // --- Image layout description ---
  const imageOrder: string[] = [];
  if (imageLayout.hasProductRefs) imageOrder.push("product reference(s)");
  if (imageLayout.hasBackgroundRef) imageOrder.push("background reference (use this as the scene background)");
  if (imageLayout.hasModelRefs) imageOrder.push("model reference(s) (pose and person style)");
  if (imageOrder.length > 0) {
    blocks.push(`You receive ${imageOrder.length} image group(s) in this order: ${imageOrder.join("; ")}.`);
  }

  // --- Layer 1: Brand DNA ---
  if (brandDna?.text) {
    blocks.push(`Brand DNA (follow this visual style):\n${brandDna.text}`);
  } else {
    blocks.push(
      "Brand: AuréLéa. Visual style: calm, minimal, feminine, premium; soft natural lighting, warm tones, elegant negative space."
    );
  }

  // --- Layer 1 continued: Scene defaults (may be overridden by runtime) ---
  const rt = runtimeInput ?? {};
  const outfit = rt.outfit ?? sceneOptions?.outfit ?? AURELEA_DEFAULT_OUTFIT;
  const feetStyle = rt.feet_style ?? (sceneOptions?.barefoot ?? AURELEA_DEFAULT_BAREFOOT ? "barefoot" : "with appropriate footwear");
  const mat = sceneOptions?.mat ?? AURELEA_DEFAULT_MAT;
  const pose = rt.pose;
  const gaze = rt.gaze;

  if (creativeFreedom === true && !runtimeInput) {
    blocks.push(
      "Choose a sporty, elegant pose and styling that fits the brand; outfit and setting can vary within the brand DNA."
    );
  } else {
    const sceneLines: string[] = [
      `Model wears ${outfit}, ${feetStyle}, training on a ${mat}.`
    ];
    if (pose) {
      sceneLines.push(`Pose: ${pose}.`);
    } else {
      sceneLines.push("Choose a single sporty, elegant pose (e.g. Pilates exercise) that shows the product in use.");
    }
    if (gaze) {
      sceneLines.push(`Gaze: ${gaze}.`);
    }
    blocks.push(`Scene requirements:\n${sceneLines.join("\n")}`);
  }

  // --- Layer 1 continued: Background ---
  if (rt.background_style) {
    blocks.push(`Background: ${rt.background_style}.`);
  } else if (useGoldenBackground && imageLayout.hasBackgroundRef) {
    blocks.push("Use the provided background reference image as the exact background of the generated scene.");
  } else if (useGoldenBackground) {
    blocks.push("Use a warm golden / sand-toned background consistent with the brand.");
  } else {
    blocks.push("Use a calm, minimal background consistent with the brand DNA (soft neutral, warm light).");
  }

  // --- Layer 2: Runtime creative hints ---
  const runtimeExtras = buildRuntimeExtras(rt);
  if (runtimeExtras) {
    blocks.push(`Creative direction (from runtime input):\n${runtimeExtras}`);
  }

  // --- Task line ---
  blocks.push(
    `Generate exactly one high-quality Amazon-style lifestyle product image: a model performing an exercise or pose with the ${productName}. The product must be clearly visible and recognisable from the reference(s). The image should be suitable for e-commerce (product listing). Output only the generated image, no text.`
  );

  // --- Layer 3: Global hard rules ---
  if (globalHardRules?.text) {
    blocks.push(`MANDATORY GLOBAL RULES (must be enforced):\n${globalHardRules.text}`);
  }

  // --- Layer 4: Product hard rules ---
  if (productHardRules?.text) {
    blocks.push(`MANDATORY PRODUCT RULES for ${productName} (must be enforced):\n${productHardRules.text}`);
  }

  const text = blocks.join("\n\n");

  return {
    id: nanoid(),
    templateId: "amazon_lifestyle_shot_v1",
    templateVersion: 2,
    workflowType: "AMAZON_LIFESTYLE_SHOT",
    text
  };
}

/**
 * Extract runtime fields that weren't already consumed by named parameters
 * (pose, gaze, outfit, feet_style, background_style are handled inline above).
 */
function buildRuntimeExtras(rt: RuntimeInput): string | null {
  const handledKeys = new Set(["pose", "gaze", "outfit", "feet_style", "background_style"]);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(rt)) {
    if (handledKeys.has(key) || !value) continue;
    const label = key.replace(/_/g, " ");
    lines.push(`- ${label}: ${value}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

