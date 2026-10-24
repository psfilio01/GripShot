import axios from "axios";
import { getEnv } from "../config/env";
import type { BuiltPrompt } from "../domain/prompt";
import type { GenerationSettings } from "./runtimeInputLoader";
import { formatGoogleGenerativeLanguageApiError } from "../utils/googleGenerativeLanguageError";
import { readImageFileForProcessing } from "./imageFileRead";

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

function mimeFromExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? "image/jpeg";
}

export function extractImagesFromContentParts(outParts: unknown[]): GeneratedImage[] {
  if (!Array.isArray(outParts)) return [];
  return outParts
    .filter((part: unknown) => {
      const p = part as {
        inlineData?: { mimeType?: string };
        inline_data?: { mime_type?: string };
      };
      return (
        p.inlineData?.mimeType?.startsWith("image/") === true ||
        p.inline_data?.mime_type?.startsWith("image/") === true
      );
    })
    .map((part: unknown) => {
      const p = part as {
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      };
      const mimeType: string =
        p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png";
      const data: string = p.inlineData?.data ?? p.inline_data?.data ?? "";
      const extension = mimeType.split("/")[1] ?? "png";
      return { buffer: Buffer.from(data, "base64"), extension };
    });
}

export function joinTextPartsFromGeminiContent(outParts: unknown[]): string {
  if (!Array.isArray(outParts)) return "";
  return outParts
    .filter((p: unknown) => typeof (p as { text?: string }).text === "string")
    .map((p: unknown) => (p as { text: string }).text)
    .join(" ");
}

function buildNoImageErrorDetail(
  responseData: unknown,
  model: string,
  attemptsTried: string[],
): string {
  const d = responseData as Record<string, unknown> | null | undefined;
  const candidate = (d?.candidates as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined;
  const finishReason = candidate?.finishReason;
  const pf = d?.promptFeedback as Record<string, unknown> | undefined;
  const blockReason = pf?.blockReason;
  const safety = candidate?.safetyRatings;
  const bits = [
    `finishReason=${String(finishReason ?? "unknown")}`,
    `model=${model}`,
    `attempts=${attemptsTried.join(" → ")}`,
  ];
  if (blockReason != null) bits.push(`promptBlockReason=${String(blockReason)}`);
  if (safety != null && JSON.stringify(safety).length < 800) {
    bits.push(`safetyRatings=${JSON.stringify(safety)}`);
  }
  return bits.join("; ");
}

/**
 * Generate images via Gemini. Reference images are sent in order (product refs, optional background, optional model).
 * Single path or array of paths supported.
 */
export interface GenerateImagesWithNanoBananaOptions {
  /** When set, overrides NANOBANANA_MODEL for this call only. */
  modelId?: string;
}

export async function generateImagesWithNanoBanana(
  prompt: BuiltPrompt,
  referenceImagePaths: ReferenceImageInput,
  generationSettings?: GenerationSettings,
  options?: GenerateImagesWithNanoBananaOptions,
): Promise<GeneratedImage[]> {
  const paths = Array.isArray(referenceImagePaths) ? referenceImagePaths : [referenceImagePaths];
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_MODEL, NANOBANANA_DRY_RUN } = getEnv();
  const effectiveModel = options?.modelId?.trim() || NANOBANANA_MODEL;

  if (NANOBANANA_DRY_RUN) {
    const first = paths[0];
    if (!first) throw new Error("At least one reference image path is required.");
    const { buffer, ext } = await readImageFileForProcessing(first);
    return [{ buffer, extension: ext }];
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("Nano Banana API key not configured.");
  }

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: prompt.text ?? "" }
  ];

  for (const p of paths) {
    const { buffer, ext } = await readImageFileForProcessing(p);
    parts.push({
      inline_data: {
        mime_type: mimeFromExt(ext),
        data: buffer.toString("base64"),
      },
    });
  }

  const url = `${NANOBANANA_BASE_URL}/models/${effectiveModel}:generateContent?key=${NANOBANANA_API_KEY}`;

  const imageConfig = generationSettings
    ? { aspectRatio: generationSettings.aspectRatio, imageSize: generationSettings.resolution }
    : undefined;

  type Attempt = { label: string; generationConfig: Record<string, unknown> };
  const attempts: Attempt[] = [
    {
      label: imageConfig ? "TEXT+IMAGE + imageConfig" : "TEXT+IMAGE",
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(imageConfig ? { imageConfig } : {}),
      },
    },
  ];
  if (imageConfig) {
    attempts.push({
      label: "TEXT+IMAGE without imageConfig",
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    });
  }
  attempts.push({
    label: "IMAGE modality only",
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  try {
    let lastResponseData: unknown;
    const attemptLabels: string[] = [];

    for (let i = 0; i < attempts.length; i++) {
      const { label, generationConfig } = attempts[i]!;
      attemptLabels.push(label);

      const response = await axios.post(
        url,
        {
          contents: [{ parts }],
          generationConfig,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 240000,
        },
      );

      lastResponseData = response.data;
      const outParts = response.data?.candidates?.[0]?.content?.parts ?? [];
      const finishReason = response.data?.candidates?.[0]?.finishReason;
      const images = extractImagesFromContentParts(outParts);
      const textJoined = joinTextPartsFromGeminiContent(outParts);
      const imagePartCount = images.length;

      console.log(
        `\x1b[36m[workflow-core:gemini]\x1b[0m [${label}] finishReason=${finishReason}, images=${imagePartCount}, textParts=${textJoined ? `"${textJoined.slice(0, 200)}"` : "(none)"}`,
      );

      if (images.length > 0) {
        return images;
      }

      const hasMoreAttempts = i < attempts.length - 1;
      if (hasMoreAttempts) {
        console.warn(
          `\x1b[33m[workflow-core:gemini]\x1b[0m No image in response; retrying (${attempts[i + 1]!.label})…`,
        );
      }
    }

    const lastParts =
      (lastResponseData as { candidates?: { content?: { parts?: unknown[] } }[] } | undefined)
        ?.candidates?.[0]?.content?.parts ?? [];
    const finishReason = (lastResponseData as { candidates?: { finishReason?: string }[] })
      ?.candidates?.[0]?.finishReason;
    const textJoined = joinTextPartsFromGeminiContent(lastParts);
    console.error(
      `\x1b[31m[workflow-core:gemini]\x1b[0m No images after ${attemptLabels.length} attempt(s). finishReason=${finishReason}, text=${textJoined.slice(0, 500)}`,
    );

    const detail = buildNoImageErrorDetail(lastResponseData, effectiveModel, attemptLabels);
    throw new Error(
      `Gemini returned no image (${detail}). ` +
        `IMAGE_OTHER/OTHER often clears on retry with relaxed settings (already tried). ` +
        `Try a different image model (e.g. gemini-nano-banana-2.1), simplify the prompt, or check reference images.`,
    );
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const finishReason = (data as any)?.candidates?.[0]?.finishReason;
      const respParts = (data as any)?.candidates?.[0]?.content?.parts;
      const formatted = formatGoogleGenerativeLanguageApiError(status, data);
      console.error(
        `\x1b[31m[workflow-core:gemini]\x1b[0m API error: ${formatted || error.message}`,
        {
          status,
          data: typeof data === "string" ? data.slice(0, 2000) : data,
          finishReason,
          partsPreview:
            respParts != null ? JSON.stringify(respParts, null, 2).slice(0, 2000) : undefined,
        },
      );
      throw new Error(formatted || error.message || "Gemini API request failed");
    }
    console.error("Unexpected error when calling Gemini API.", error);
    throw error;
  }
}
