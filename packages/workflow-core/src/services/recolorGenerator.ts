import axios from "axios";
import fs from "fs-extra";
import path from "node:path";
import { getEnv } from "../config/env";
import type { SceneLock } from "../domain/sceneLock";
import type { GeneratedImage } from "./imageGenerator";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface RecolorRequest {
  masterImagePath: string;
  sceneLock: SceneLock;
  targetColorName: string;
  targetColorHex: string;
  aspectRatio?: string;
}

/**
 * Generates a color variant of the hero image using Gemini image editing.
 * Sends the master image + an invariant-focused recolor prompt.
 */
export async function generateRecolorVariant(
  request: RecolorRequest,
): Promise<GeneratedImage> {
  const {
    NANOBANANA_API_KEY,
    NANOBANANA_BASE_URL,
    NANOBANANA_MODEL,
    NANOBANANA_DRY_RUN,
  } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    const buffer = await fs.readFile(request.masterImagePath);
    const ext =
      path.extname(request.masterImagePath).replace(/^\./, "") || "png";
    return { buffer, extension: ext };
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for recolor generation.");
  }

  const buffer = await fs.readFile(request.masterImagePath);
  const ext = path
    .extname(request.masterImagePath)
    .replace(/^\./, "")
    .toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "image/jpeg";
  const base64 = buffer.toString("base64");

  const prompt = buildRecolorPrompt(request);
  const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;

  const imageConfig = request.aspectRatio
    ? { aspectRatio: request.aspectRatio }
    : undefined;

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
        responseModalities: ["TEXT", "IMAGE"],
        ...(imageConfig && { imageConfig }),
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 240000,
    },
  );

  const outParts = response.data?.candidates?.[0]?.content?.parts ?? [];
  console.log(
    `Recolor response for ${request.targetColorName}: finishReason=${response.data?.candidates?.[0]?.finishReason}, parts=${outParts.length}`,
  );

  const imagePart = outParts.find(
    (part: any) =>
      part.inlineData?.mimeType?.startsWith("image/") ||
      part.inline_data?.mime_type?.startsWith("image/"),
  );

  if (!imagePart) {
    throw new Error(
      `Recolor generation for ${request.targetColorName} returned no image.`,
    );
  }

  const outMime: string =
    imagePart.inlineData?.mimeType ?? imagePart.inline_data?.mime_type;
  const outData: string =
    imagePart.inlineData?.data ?? imagePart.inline_data?.data;
  const outExt = outMime.split("/")[1] ?? "png";

  return {
    buffer: Buffer.from(outData, "base64"),
    extension: outExt,
  };
}

function buildRecolorPrompt(request: RecolorRequest): string {
  const { sceneLock, targetColorName, targetColorHex } = request;
  const fromColor = sceneLock.detectedProductColor ?? "the current color";

  const invariants = sceneLock.protectedInvariants.length > 0
    ? sceneLock.protectedInvariants.join(", ")
    : "model pose, camera angle, lighting, background, product geometry, logo placement";

  return [
    `Edit this product image to change ONLY the product color from ${fromColor} to ${targetColorName} (${targetColorHex}).`,
    "",
    "CRITICAL INVARIANTS — do NOT change any of the following:",
    `- ${invariants}`,
    "- The product shape, size, texture, and surface finish must remain identical",
    "- The model's pose, expression, clothing, and position must be exactly the same",
    "- The lighting direction, warmth, and shadow pattern must be preserved",
    "- The background, composition, and framing must not change at all",
    "- Any logos, text, or branding on the product must stay in the same position",
    "",
    "ONLY the product material/surface color should change to:",
    `Color: ${targetColorName}`,
    `Hex: ${targetColorHex}`,
    "",
    "The result should look like the exact same photograph taken of the exact same scene,",
    "but with the product manufactured in a different color.",
  ].join("\n");
}
