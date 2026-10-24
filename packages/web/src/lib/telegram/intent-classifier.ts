import { z } from "zod";
import { formatGoogleGenerativeLanguageApiError } from "@fashionmentum/workflow-core";
import { createLogger } from "@/lib/logger";
import type { ClassifiedIntent, TelegramIntent } from "./types";

const log = createLogger("telegram:intent");

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
    throw new Error("Set GEMINI_API_KEY or NANOBANANA_API_KEY for intent classification");
  }
  return {
    apiKey: apiKey ?? "",
    model: env.GEMINI_TEXT_MODEL,
    dryRun: env.GEMINI_DRY_RUN,
  };
}

const VALID_INTENTS: TelegramIntent[] = [
  "create_workflow",
  "create_model",
  "create_background",
  "create_product",
  "question",
  "feedback",
  "unknown",
];

const CLASSIFICATION_SCHEMA = {
  type: "object" as const,
  properties: {
    intent: {
      type: "string" as const,
      enum: VALID_INTENTS,
      description:
        "The classified intent of the user message. " +
        "'create_workflow' if the user wants to create images, a shoot, a flyer, product photos, or any content generation task. " +
        "'create_model' if the user wants to create/add a new human model or AI model for photoshoots. " +
        "'create_background' if the user wants to create/add a new background for photoshoots. " +
        "'create_product' if the user wants to create/add a new product to manage. " +
        "'question' if the user is asking about their account, status, credits, or how something works. " +
        "'feedback' if the user is giving feedback on a generated result. " +
        "'unknown' otherwise.",
    },
    description: {
      type: "string" as const,
      description:
        "If intent is 'create_workflow', a cleaned-up English summary of what the user wants to create. " +
        "If intent is 'create_model'/'create_background'/'create_product', any relevant details mentioned. " +
        "Otherwise null.",
    },
  },
  required: ["intent"],
};

const SYSTEM_PROMPT =
  "You are an intent classifier for a product photography AI bot (GripShot). " +
  "Classify the user's Telegram message into one of the intents. " +
  "The user may write in German, English, or other languages. " +
  "If they describe wanting to create images, photos, a flyer, product shots, " +
  "lifestyle images, exercises, or any content generation task, classify as 'create_workflow'. " +
  "If they want to add/create a new model (person for photos), classify as 'create_model'. " +
  "If they want to add/create a new background/scene, classify as 'create_background'. " +
  "If they want to add/create a new product (item to photograph), classify as 'create_product'. " +
  "If they ask about their plan, credits, status, or how something works, classify as 'question'. " +
  "If they comment on a generated image (e.g. 'too dark', 'love it', 'more contrast'), classify as 'feedback'. " +
  "If the intent is ambiguous, classify as 'unknown'. Do NOT guess.";

const DRY_RUN_RESULT: ClassifiedIntent = {
  intent: "create_workflow",
  description: "[DRY RUN] Create 10 Pilates exercises with mini ball for a flyer",
};

export async function classifyIntent(
  userMessage: string,
): Promise<ClassifiedIntent> {
  const config = getConfig();

  if (config.dryRun) {
    log.info("Dry run — returning mock classification");
    return DRY_RUN_RESULT;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CLASSIFICATION_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 256,
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
    log.error("Intent classification API error", {
      status: response.status,
      detail: raw.slice(0, 2000),
    });
    throw new Error(detail || `Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    log.warn("No text in intent classification response, defaulting to unknown");
    return { intent: "unknown" };
  }

  try {
    const result = JSON.parse(text) as ClassifiedIntent;
    if (!VALID_INTENTS.includes(result.intent)) {
      log.warn("Invalid intent from classifier", { raw: result.intent });
      return { intent: "unknown" };
    }
    return result;
  } catch {
    log.warn("Failed to parse classification JSON", { text: text.slice(0, 500) });
    return { intent: "unknown" };
  }
}
