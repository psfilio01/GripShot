import axios from "axios";
import fs from "fs-extra";
import path from "node:path";
import { getEnv } from "../config/env";
import {
  type SceneLock,
  SCENE_LOCK_JSON_SCHEMA,
} from "../domain/sceneLock";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Extracts structured scene metadata from an image using Gemini's structured output.
 * Uses text-only model with JSON schema for reliable extraction.
 * The image model cannot produce JSON structured output, so we use gemini-2.5-flash.
 */
export async function extractSceneLock(
  imagePath: string,
  sourceAssetId: string,
  productId: string,
  outputType: string,
): Promise<SceneLock> {
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_DRY_RUN } =
    getEnv();

  if (NANOBANANA_DRY_RUN) {
    return makeDryRunSceneLock(sourceAssetId, productId, outputType);
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for scene extraction.");
  }

  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).replace(/^\./, "").toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "image/jpeg";
  const base64 = buffer.toString("base64");

  const textModel = "gemini-2.5-flash";
  const url = `${NANOBANANA_BASE_URL}/models/${textModel}:generateContent?key=${NANOBANANA_API_KEY}`;

  const prompt = `Analyze this product image in detail. Extract the scene composition, subject, product placement, camera framing, lighting, background, and the apparent product color. List the visual invariants that should be preserved if only the product color were to change. Be specific and precise.`;

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
        responseSchema: SCENE_LOCK_JSON_SCHEMA,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    },
  );

  const textPart = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Scene extraction returned no text content.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textPart);
  } catch {
    console.error("Scene extraction JSON parse failed:", textPart.slice(0, 500));
    throw new Error("Scene extraction returned invalid JSON.");
  }

  const sceneLock: SceneLock = {
    sourceAssetId,
    productId,
    outputType,
    sceneDescription: String(parsed.sceneDescription ?? ""),
    subjectDescription: String(parsed.subjectDescription ?? ""),
    productPlacement: String(parsed.productPlacement ?? ""),
    compositionNotes: String(parsed.compositionNotes ?? ""),
    cameraFraming: String(parsed.cameraFraming ?? ""),
    lightingNotes: String(parsed.lightingNotes ?? ""),
    backgroundNotes: String(parsed.backgroundNotes ?? ""),
    protectedInvariants: Array.isArray(parsed.protectedInvariants)
      ? (parsed.protectedInvariants as string[])
      : [],
    editableTargetFields: ["productColor"],
    detectedProductColor: parsed.detectedProductColor
      ? String(parsed.detectedProductColor)
      : null,
    extractedAt: new Date().toISOString(),
  };

  console.log(
    `Scene extraction complete for ${sourceAssetId}: detected color = ${sceneLock.detectedProductColor}`,
  );

  return sceneLock;
}

function makeDryRunSceneLock(
  sourceAssetId: string,
  productId: string,
  outputType: string,
): SceneLock {
  return {
    sourceAssetId,
    productId,
    outputType,
    sceneDescription: "[DRY RUN] Bright studio environment",
    subjectDescription: "[DRY RUN] Person in neutral activewear",
    productPlacement: "[DRY RUN] Product held at center frame",
    compositionNotes: "[DRY RUN] Centered, balanced composition",
    cameraFraming: "[DRY RUN] Medium shot, slight elevation",
    lightingNotes: "[DRY RUN] Soft natural light, warm tone",
    backgroundNotes: "[DRY RUN] Clean minimal background",
    protectedInvariants: [
      "model pose",
      "camera angle",
      "lighting",
      "background",
      "product geometry",
      "logo placement",
    ],
    editableTargetFields: ["productColor"],
    detectedProductColor: "sage green",
    extractedAt: new Date().toISOString(),
  };
}
