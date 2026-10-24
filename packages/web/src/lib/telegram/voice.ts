import { z } from "zod";
import { formatGoogleGenerativeLanguageApiError } from "@fashionmentum/workflow-core";
import { createLogger } from "@/lib/logger";
import { getFile, downloadFile } from "./client";

const log = createLogger("telegram:voice");

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  NANOBANANA_API_KEY: z.string().min(1).optional(),
  GEMINI_TEXT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_DRY_RUN: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

function getConfig() {
  const env = envSchema.parse(process.env);
  const apiKey = env.GEMINI_API_KEY ?? env.NANOBANANA_API_KEY;
  if (!apiKey && !env.GEMINI_DRY_RUN) {
    throw new Error("Set GEMINI_API_KEY or NANOBANANA_API_KEY for voice transcription");
  }
  return {
    apiKey: apiKey ?? "",
    model: env.GEMINI_TEXT_MODEL,
    dryRun: env.GEMINI_DRY_RUN,
  };
}

const DRY_RUN_TRANSCRIPTION =
  "[DRY RUN] Bitte erstelle ein Produktfoto von dem blauen Yoga-Ball auf weißem Hintergrund.";

/**
 * Download a voice/audio file from Telegram and transcribe it via Gemini.
 * Returns the transcribed text.
 */
export async function transcribeVoiceMessage(fileId: string): Promise<string> {
  const config = getConfig();

  if (config.dryRun) {
    log.info("Dry run — returning mock transcription");
    return DRY_RUN_TRANSCRIPTION;
  }

  log.info("Downloading voice file from Telegram", { fileId });
  const tgFile = await getFile(fileId);
  if (!tgFile.file_path) {
    throw new Error("Telegram getFile returned no file_path");
  }

  const audioBuffer = await downloadFile(tgFile.file_path);
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  const mimeType = tgFile.file_path.endsWith(".oga") || tgFile.file_path.endsWith(".ogg")
    ? "audio/ogg"
    : "audio/mpeg";

  log.info("Sending audio to Gemini for transcription", {
    sizeBytes: audioBuffer.byteLength,
    mimeType,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64,
              },
            },
            {
              text: "Transcribe this voice message exactly as spoken. Return only the transcription, nothing else. Detect the language automatically.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let parsed: unknown = raw;
    try {
      parsed = raw ? (JSON.parse(raw) as unknown) : raw;
    } catch {
      parsed = raw;
    }
    const detail = formatGoogleGenerativeLanguageApiError(response.status, parsed);
    log.error("Gemini transcription API error", {
      status: response.status,
      detail: raw.slice(0, 2000),
    });
    throw new Error(detail || `Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    log.error("No transcription in Gemini response", {
      response: JSON.stringify(data).slice(0, 2000),
    });
    throw new Error("No transcription in Gemini response");
  }

  log.info("Transcription complete", { length: text.length });
  return text.trim();
}
