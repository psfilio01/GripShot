import { config } from "dotenv";
import { resolve } from "path";
import { formatGoogleGenerativeLanguageApiError } from "@fashionmentum/workflow-core";

config({ path: resolve(process.cwd(), "../../.env") });

function getEnvVar(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (!val) throw new Error(`Missing env variable: ${name}`);
  return val;
}

export interface GeneratedImageResult {
  buffer: Buffer;
  extension: string;
}

/**
 * Generate an image from a text-only prompt via Gemini.
 * Used for AI model creation and background generation (no reference images needed).
 */
export async function generateImageFromPrompt(
  prompt: string,
  aspectRatio: string = "4:5",
): Promise<GeneratedImageResult> {
  const apiKey = getEnvVar("NANOBANANA_API_KEY");
  const baseUrl = getEnvVar(
    "NANOBANANA_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta",
  );
  const model = getEnvVar("NANOBANANA_MODEL", "gemini-2.0-flash-exp");

  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let body: unknown = text;
    try {
      body = text ? (JSON.parse(text) as unknown) : text;
    } catch {
      body = text;
    }
    const detail = formatGoogleGenerativeLanguageApiError(response.status, body);
    throw new Error(detail || `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inlineData = part.inlineData ?? part.inline_data;
    if (!inlineData) continue;
    const mimeType: string = inlineData.mimeType ?? inlineData.mime_type ?? "";
    if (!mimeType.startsWith("image/")) continue;
    const extension = mimeType.split("/")[1] ?? "png";
    const buffer = Buffer.from(inlineData.data, "base64");
    return { buffer, extension };
  }

  console.error(
    "Gemini response parts (no image):",
    JSON.stringify(parts, null, 2).slice(0, 2000),
  );
  throw new Error("Gemini returned no image in the response.");
}
