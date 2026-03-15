import axios from "axios";
import fs from "fs-extra";
import path from "node:path";
import { getEnv } from "../config/env";
import type { BuiltPrompt } from "../domain/prompt";
import type { GenerationSettings } from "./runtimeInputLoader";

export interface GeneratedImage {
  buffer: Buffer;
  extension?: string;
}

/** Ordered list of reference image paths (product, then optional background, then optional model). */
export type ReferenceImageInput = string | string[];

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

/**
 * Generate images via Gemini. Reference images are sent in order (product refs, optional background, optional model).
 * Single path or array of paths supported.
 */
export async function generateImagesWithNanoBanana(
  prompt: BuiltPrompt,
  referenceImagePaths: ReferenceImageInput,
  generationSettings?: GenerationSettings
): Promise<GeneratedImage[]> {
  const paths = Array.isArray(referenceImagePaths) ? referenceImagePaths : [referenceImagePaths];
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_MODEL, NANOBANANA_DRY_RUN } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    const first = paths[0];
    if (!first) throw new Error("At least one reference image path is required.");
    const imageBuffer = await fs.readFile(first);
    const ext = path.extname(first).replace(/^\./, "") || "jpg";
    return [{ buffer: imageBuffer, extension: ext }];
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("Nano Banana API key not configured.");
  }

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: prompt.text ?? "" }
  ];

  for (const p of paths) {
    const buffer = await fs.readFile(p);
    parts.push({
      inline_data: {
        mime_type: mimeFromPath(p),
        data: buffer.toString("base64")
      }
    });
  }

  const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;

  const imageConfig = generationSettings
    ? { aspectRatio: generationSettings.aspectRatio, imageSize: generationSettings.resolution }
    : undefined;

  try {
    const response = await axios.post(
      url,
      {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(imageConfig && { imageConfig })
        }
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 240000
      }
    );

    const outParts = response.data?.candidates?.[0]?.content?.parts ?? [];
    console.log("Gemini response finishReason:", response.data?.candidates?.[0]?.finishReason);
    console.log("Gemini response parts (truncated):", JSON.stringify(outParts, null, 2).slice(0, 2000));

    const images: GeneratedImage[] = outParts
      .filter(
        (part: any) =>
          part.inlineData?.mimeType?.startsWith("image/") || part.inline_data?.mime_type?.startsWith("image/")
      )
      .map((part: any) => {
        const mimeType: string = part.inlineData?.mimeType ?? part.inline_data?.mime_type;
        const data: string = part.inlineData?.data ?? part.inline_data?.data;
        const extension = mimeType.split("/")[1] ?? "png";
        const buffer = Buffer.from(data, "base64");
        return { buffer, extension };
      });

    if (images.length === 0) {
      console.error("Gemini response contained no image parts.", {
        finishReason: response.data?.candidates?.[0]?.finishReason
      });
      throw new Error("Gemini response contained no images.");
    }

    return images;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const data = error.response?.data;
      const finishReason = (data as any)?.candidates?.[0]?.finishReason;
      const respParts = (data as any)?.candidates?.[0]?.content?.parts;
      console.error("Gemini API request failed.", {
        status,
        statusText,
        data: typeof data === "string" ? data.slice(0, 2000) : data,
        finishReason,
        partsPreview: respParts != null ? JSON.stringify(respParts, null, 2).slice(0, 2000) : undefined
      });
    } else {
      console.error("Unexpected error when calling Gemini API.", error);
    }
    throw error;
  }
}