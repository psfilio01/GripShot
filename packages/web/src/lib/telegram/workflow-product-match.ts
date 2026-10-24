import { z } from "zod";
import { formatGoogleGenerativeLanguageApiError } from "@fashionmentum/workflow-core";
import { createLogger } from "@/lib/logger";

const log = createLogger("telegram:workflow-product-match");

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
    throw new Error("Set GEMINI_API_KEY or NANOBANANA_API_KEY for product matching");
  }
  return {
    apiKey: apiKey ?? "",
    model: env.GEMINI_TEXT_MODEL,
    dryRun: env.GEMINI_DRY_RUN,
  };
}

const RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    productId: {
      type: "string" as const,
      description:
        "The id from the catalog that best matches the user's workflow description, or empty string if none fits.",
    },
  },
  required: ["productId"] as const,
};

const SYSTEM_PROMPT =
  "You match a user's workflow request to one product in a catalog. " +
  "The user may write in German or English. " +
  "Pick the single best-matching product id from the list. " +
  "If the request is generic or no product clearly fits, return an empty string for productId. " +
  "Never invent ids — only return ids that appear in the catalog.";

/**
 * Returns the best-matching product id, or null if the model returns none / invalid id.
 */
export async function matchProductForWorkflow(
  userDescription: string,
  products: { id: string; name: string; category?: string }[],
): Promise<string | null> {
  if (products.length === 0) return null;

  const config = getConfig();
  if (config.dryRun) {
    return products[0]?.id ?? null;
  }

  const catalog = products
    .map(
      (p) =>
        `- id: ${p.id}\n  name: ${p.name}${p.category ? `\n  category: ${p.category}` : ""}`,
    )
    .join("\n");

  const userPrompt =
    `User workflow description:\n"""${userDescription.slice(0, 4000)}"""\n\n` +
    `Product catalog:\n${catalog}\n\n` +
    "Respond with JSON: productId is the chosen id or empty string.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
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
    log.error("Product match API error", { status: response.status, detail: raw.slice(0, 500) });
    throw new Error(detail || `Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    log.warn("No text in product match response");
    return null;
  }

  try {
    const parsed = JSON.parse(text) as { productId?: string };
    const id = typeof parsed.productId === "string" ? parsed.productId.trim() : "";
    if (!id) return null;
    return products.some((p) => p.id === id) ? id : null;
  } catch {
    log.warn("Failed to parse product match JSON", { text: text.slice(0, 300) });
    return null;
  }
}
