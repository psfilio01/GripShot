import axios from "axios";
import fs from "fs-extra";
import path from "node:path";
import { getEnv } from "../config/env";
import {
  type QualityScore,
  type QualityScorerInput,
  QUALITY_SCORE_JSON_SCHEMA,
} from "../domain/qualityScore";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const GOAL_DESCRIPTIONS: Record<string, string> = {
  MAIN_IMAGE: "Amazon Main Image: product isolated on pure white background, no people or props",
  NEUTRAL_PRODUCT_SHOT: "Neutral ecommerce product shot on clean background",
  AMAZON_LIFESTYLE_SHOT: "Amazon lifestyle image: product in use with a person",
  LIFESTYLE: "Amazon lifestyle image: product in use with a person",
  SCALE_REFERENCE: "Scale reference: product shown with a size reference (hand, person, everyday object)",
  DETAIL_CLOSEUP: "Detail close-up: material, texture, or craftsmanship macro shot",
  A_PLUS_VISUAL: "Amazon A+ Content premium visual: aspirational, editorial product image",
};

/**
 * Scores a generated image against its intended goal using Gemini structured output.
 *
 * This is an **opt-in** post-generation step — callers decide when to invoke it.
 * Follows the same pattern as sceneExtractor (gemini-2.5-flash + JSON schema).
 */
export async function scoreImageQuality(
  input: QualityScorerInput,
): Promise<QualityScore> {
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_DRY_RUN } =
    getEnv();

  if (NANOBANANA_DRY_RUN) {
    return makeDryRunScore();
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for quality scoring.");
  }

  const buffer = await fs.readFile(input.imagePath);
  const ext = path.extname(input.imagePath).replace(/^\./, "").toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "image/jpeg";
  const base64 = buffer.toString("base64");

  const goalDesc =
    GOAL_DESCRIPTIONS[input.workflowType] ?? "Product image for ecommerce";
  const productHint = input.productName
    ? ` The product is: ${input.productName}.`
    : "";
  const categoryHint = input.productCategory
    ? ` Product category: ${input.productCategory}.`
    : "";

  const prompt =
    `You are a professional Amazon product photography quality assessor. ` +
    `Evaluate this generated product image.${productHint}${categoryHint} ` +
    `The intended goal was: ${goalDesc}. ` +
    `Score the image from 1 (unusable) to 10 (perfect). ` +
    `Check whether the product is clearly visible, proportions are realistic, ` +
    `and the stated goal is met. List any specific issues found.`;

  const textModel = "gemini-2.5-flash";
  const url = `${NANOBANANA_BASE_URL}/models/${textModel}:generateContent?key=${NANOBANANA_API_KEY}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: QUALITY_SCORE_JSON_SCHEMA,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    },
  );

  const textPart = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Quality scoring returned no text content.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textPart);
  } catch {
    console.error("Quality score JSON parse failed:", textPart.slice(0, 500));
    throw new Error("Quality scoring returned invalid JSON.");
  }

  const score: QualityScore = {
    overallScore: clampScore(parsed.overallScore),
    productVisible: Boolean(parsed.productVisible),
    proportionsPlausible: Boolean(parsed.proportionsPlausible),
    goalMet: Boolean(parsed.goalMet),
    issues: Array.isArray(parsed.issues)
      ? (parsed.issues as string[])
      : [],
  };

  console.log(
    `Quality score for ${input.workflowType}: ${score.overallScore}/10, ` +
    `visible=${score.productVisible}, proportions=${score.proportionsPlausible}, ` +
    `goalMet=${score.goalMet}, issues=${score.issues.length}`,
  );

  return score;
}

function clampScore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function makeDryRunScore(): QualityScore {
  return {
    overallScore: 8,
    productVisible: true,
    proportionsPlausible: true,
    goalMet: true,
    issues: [],
  };
}
