/**
 * SceneLock captures the "image DNA" of an approved hero image.
 * Used to guide color variant generation and future non-color edits.
 */
export interface SceneLock {
  sourceAssetId: string;
  productId: string;
  outputType: string;
  sceneDescription: string;
  subjectDescription: string;
  productPlacement: string;
  compositionNotes: string;
  cameraFraming: string;
  lightingNotes: string;
  backgroundNotes: string;
  protectedInvariants: string[];
  editableTargetFields: string[];
  detectedProductColor: string | null;
  extractedAt: string;
}

export function isValidSceneLock(value: unknown): value is SceneLock {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;

  const requiredStrings = [
    "sourceAssetId",
    "productId",
    "outputType",
    "sceneDescription",
    "subjectDescription",
    "productPlacement",
    "compositionNotes",
    "cameraFraming",
    "lightingNotes",
    "backgroundNotes",
    "extractedAt",
  ];

  for (const key of requiredStrings) {
    if (typeof obj[key] !== "string" || !(obj[key] as string).length) {
      return false;
    }
  }

  if (!Array.isArray(obj.protectedInvariants)) return false;
  if (!Array.isArray(obj.editableTargetFields)) return false;
  if (
    obj.detectedProductColor !== null &&
    typeof obj.detectedProductColor !== "string"
  ) {
    return false;
  }

  return true;
}

/**
 * JSON Schema for Gemini structured output extraction.
 * Used with responseMimeType: "application/json" on text-only models.
 */
export const SCENE_LOCK_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    sceneDescription: {
      type: "string" as const,
      description: "Overall scene setting, mood, and environment",
    },
    subjectDescription: {
      type: "string" as const,
      description:
        "Description of the human subject: pose, expression, body position, clothing",
    },
    productPlacement: {
      type: "string" as const,
      description:
        "How and where the product appears in the image: position, grip, angle, prominence",
    },
    compositionNotes: {
      type: "string" as const,
      description: "Framing, rule of thirds, negative space, visual balance",
    },
    cameraFraming: {
      type: "string" as const,
      description: "Camera angle, distance, focal length, depth of field",
    },
    lightingNotes: {
      type: "string" as const,
      description:
        "Light direction, warmth, shadows, contrast level, key/fill ratios",
    },
    backgroundNotes: {
      type: "string" as const,
      description: "Background elements, colors, bokeh, gradients, textures",
    },
    detectedProductColor: {
      type: "string" as const,
      description:
        "The apparent color of the main product as seen in the image. Use a common color name.",
    },
    protectedInvariants: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "List of visual elements that must NOT change in color variants: model pose, camera angle, lighting, background, logo placement, product geometry",
    },
  },
  required: [
    "sceneDescription",
    "subjectDescription",
    "productPlacement",
    "compositionNotes",
    "cameraFraming",
    "lightingNotes",
    "backgroundNotes",
    "detectedProductColor",
    "protectedInvariants",
  ],
};
