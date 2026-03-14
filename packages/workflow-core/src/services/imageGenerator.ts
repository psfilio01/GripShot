import axios from "axios";
import fs from "fs-extra";
import { getEnv } from "../config/env";
import type { BuiltPrompt } from "../domain/prompt";

export interface GeneratedImage {
  buffer: Buffer;
  extension?: string;
}

export async function generateImagesWithNanoBanana(
  prompt: BuiltPrompt,
  referenceImagePath: string
): Promise<GeneratedImage[]> {
  const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_MODEL, NANOBANANA_DRY_RUN } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    const imageBuffer = await fs.readFile(referenceImagePath);
    return [{ buffer: imageBuffer, extension: "jpg" }];
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("Nano Banana API key not configured.");
  }

  // Read and base64-encode the reference image
  const imageBuffer = await fs.readFile(referenceImagePath);
  const imageBase64 = imageBuffer.toString("base64");

  // Gemini API: POST to generateContent with API key as query param (not Bearer token)
  const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              {
                text: prompt.text ?? ""
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE"]
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 120000
      }
    );

    // Gemini returns images as base64 inline_data inside parts
    const parts = response.data?.candidates?.[0]?.content?.parts ?? [];

    // Detailed debug logging for successful responses
    console.log("Gemini response finishReason:", response.data?.candidates?.[0]?.finishReason);
    console.log("Gemini response parts (truncated):", JSON.stringify(parts, null, 2).slice(0, 2000));

    const images: GeneratedImage[] = parts
    .filter((part: any) => 
      part.inlineData?.mimeType?.startsWith("image/") ||
      part.inline_data?.mime_type?.startsWith("image/")  // Fallback für snake_case
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
      const parts = (data as any)?.candidates?.[0]?.content?.parts;

      console.error("Gemini API request failed.", {
        status,
        statusText,
        // Truncate potentially large payloads but keep structure for debugging
        data: typeof data === "string" ? data.slice(0, 2000) : data,
        finishReason,
        partsPreview:
          parts != null ? JSON.stringify(parts, null, 2).slice(0, 2000) : undefined
      });
    } else {
      console.error("Unexpected error when calling Gemini API.", error);
    }

    // Re-throw so callers still see the failure
    throw error;
  }
}