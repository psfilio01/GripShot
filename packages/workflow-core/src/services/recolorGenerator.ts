import axios from "axios";
import { createHash } from "node:crypto";
import { getEnv } from "../config/env";
import { readImageFileForProcessing } from "./imageFileRead";
import { withGeminiImageParts } from "./geminiImageTransport";
import type { SceneLock } from "../domain/sceneLock";
import type { GeneratedImage } from "./imageGenerator";
import type { ProductRecolorPolicy } from "../types/api";
import { buildRecolorPolicyPrompt } from "./recolorPolicy";
import type { RecolorProvenance } from "../domain/imageVariant";

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
  targetColorNotes?: string;
  recolorPolicy?: ProductRecolorPolicy;
  aspectRatio?: string;
  signal?: AbortSignal;
}

export interface GeneratedRecolorImage extends GeneratedImage {
  provenance?: RecolorProvenance;
}

/**
 * Generates a color variant of the hero image using Gemini image editing.
 * Sends the master image + an invariant-focused recolor prompt.
 */
export async function generateRecolorVariant(
  request: RecolorRequest,
): Promise<GeneratedRecolorImage> {
  const {
    NANOBANANA_API_KEY,
    NANOBANANA_BASE_URL,
    NANOBANANA_MODEL,
    NANOBANANA_DRY_RUN,
  } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    const { buffer, ext } = await readImageFileForProcessing(request.masterImagePath);
    return { buffer, extension: ext || "png" };
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for recolor generation.");
  }

  const { buffer, ext: extRaw } = await readImageFileForProcessing(request.masterImagePath);
  const ext = extRaw.toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "image/jpeg";

  const prompt = buildRecolorPrompt(request);
  const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;

  // Hero variants are selling assets, not previews. Nano Banana defaults to
  // 1K (928×1152 at 4:5); explicitly request its native 4K output instead
  // of trying to upscale the 1K result afterward. If an aspect ratio is not
  // supplied, Gemini keeps the reference image's native ratio.
  const imageConfig = {
    ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
    imageSize: "4K",
  };

  const generationConfig = {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig,
  };
  const response = await withGeminiImageParts([{ buffer, mimeType }], {
    apiKey: NANOBANANA_API_KEY,
    baseUrl: NANOBANANA_BASE_URL,
    signal: request.signal,
    requestOverheadBytes: Buffer.byteLength(JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig })),
  }, (imageParts) => axios.post(
    url,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            ...imageParts,
          ],
        },
      ],
      generationConfig,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 240000,
      signal: request.signal,
    },
  ));

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
    provenance: buildRecolorProvenance(request, buffer, NANOBANANA_MODEL, prompt),
  };
}

export function buildRecolorProvenance(
  request: RecolorRequest,
  source: Buffer,
  imageModel: string,
  prompt: string,
): RecolorProvenance {
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const rules = {
    policy: { ...request.recolorPolicy },
    targetColorNotes: request.targetColorNotes ?? "",
    extractedRules: [...(request.sceneLock.recolorRules ?? [])],
  };
  return {
    sourceSha256: hash(source),
    imageModel,
    promptSha256: hash(prompt),
    rulesSha256: hash(JSON.stringify(rules)),
    rules,
  };
}

export function buildRecolorPrompt(request: RecolorRequest): string {
  const { sceneLock, targetColorName, targetColorHex } = request;
  const fromColor = sceneLock.detectedProductColor ?? "the current color";

  const invariants = sceneLock.protectedInvariants.length > 0
    ? sceneLock.protectedInvariants.join(", ")
    : "model pose, camera angle, lighting, background, product geometry, logo placement";
  const policyPrompt = buildRecolorPolicyPrompt(request.recolorPolicy, request.targetColorNotes, sceneLock.recolorRules);

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
    ...(policyPrompt ? [policyPrompt, ""] : []),
    "The result should look like the exact same photograph taken of the exact same scene,",
    "but with the product manufactured in a different color.",
  ].join("\n");
}
