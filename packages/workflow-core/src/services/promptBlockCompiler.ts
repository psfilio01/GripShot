import axios from "axios";
import { getEnv } from "../config/env";

export interface CompiledPromptBlock {
  /** The refined, English prompt block safe to inject into any workflow. */
  compiledText: string;
  /** Whether the input is compatible with the generation pipeline. */
  isCompatible: boolean;
  /** Specific conflicts or issues found (empty when compatible). */
  issues: string[];
  /** Detected input language (ISO 639-1 code). */
  detectedLanguage: string;
}

const COMPILE_SCHEMA = {
  type: "object" as const,
  properties: {
    compiledText: {
      type: "string" as const,
      description:
        "The refined English prompt block, safe to inject into any image generation workflow. " +
        "Remove any parts that conflict with workflow-specific instructions.",
    },
    isCompatible: {
      type: "boolean" as const,
      description:
        "True if the user input is fully compatible. False if parts were removed or the input is empty.",
    },
    issues: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "List of specific issues found (in the user's input language for display). " +
        "Empty array if no issues.",
    },
    detectedLanguage: {
      type: "string" as const,
      description: "ISO 639-1 language code of the user's input (e.g. 'en', 'de', 'fr').",
    },
  },
  required: ["compiledText", "isCompatible", "issues", "detectedLanguage"],
};

/**
 * Translates + validates a user's freestyle prompt block using Gemini.
 *
 * The compiled output is persisted on the product and reused across all
 * generations — this function is called only when the user saves/updates
 * the block, not on every generation.
 */
export async function compileUserPromptBlock(
  rawText: string,
  productName?: string,
): Promise<CompiledPromptBlock> {
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_DRY_RUN } =
    getEnv();

  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      compiledText: "",
      isCompatible: true,
      issues: [],
      detectedLanguage: "en",
    };
  }

  if (NANOBANANA_DRY_RUN) {
    return {
      compiledText: trimmed,
      isCompatible: true,
      issues: [],
      detectedLanguage: "en",
    };
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for prompt compilation.");
  }

  const productHint = productName ? ` The product is: "${productName}".` : "";

  const prompt =
    `You are a product photography prompt engineer for an Amazon seller SaaS tool.` +
    `${productHint}\n\n` +
    `A user provided custom instructions that will be injected into EVERY image generation workflow ` +
    `(neutral product shot, lifestyle, main image, scale reference, detail close-up, A+ visual).\n\n` +
    `Your tasks:\n` +
    `1. Detect the input language.\n` +
    `2. Translate the text to English if not already English.\n` +
    `3. Check for conflicts with the standard pipeline:\n` +
    `   ALLOWED topics: lighting, logo/branding visibility, product color accuracy, ` +
    `background preferences, surface/material emphasis, product positioning/orientation, ` +
    `reflection/shadow preferences, overall mood/atmosphere.\n` +
    `   NOT ALLOWED topics: model poses, camera angles, specific compositions, ` +
    `outfit/clothing choices, workflow-specific overrides, text overlays.\n` +
    `4. If conflicts are found, remove the conflicting parts from the compiled text ` +
    `and list each issue (in the user's original language so they can understand).\n` +
    `5. Output a clean, refined English prompt block.\n\n` +
    `User's custom instructions:\n"${trimmed}"`;

  const textModel = "gemini-2.5-flash";
  const url = `${NANOBANANA_BASE_URL}/models/${textModel}:generateContent?key=${NANOBANANA_API_KEY}`;

  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: COMPILE_SCHEMA,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    },
  );

  const textPart = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Prompt compilation returned no text content.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textPart);
  } catch {
    throw new Error("Prompt compilation returned invalid JSON.");
  }

  return {
    compiledText: typeof parsed.compiledText === "string" ? parsed.compiledText : "",
    isCompatible: Boolean(parsed.isCompatible),
    issues: Array.isArray(parsed.issues) ? (parsed.issues as string[]) : [],
    detectedLanguage:
      typeof parsed.detectedLanguage === "string" ? parsed.detectedLanguage : "en",
  };
}
