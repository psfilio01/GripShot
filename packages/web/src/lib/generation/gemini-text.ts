import { z } from "zod";

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
    throw new Error("Set GEMINI_API_KEY or NANOBANANA_API_KEY for text generation");
  }
  return {
    apiKey: apiKey ?? "",
    model: env.GEMINI_TEXT_MODEL,
    dryRun: env.GEMINI_DRY_RUN,
  };
}

const DRY_RUN_RESPONSE = JSON.stringify({
  title: "[DRY RUN] Premium Pilates Mini Ball — 23cm Soft Anti-Burst Exercise Ball for Core Training",
  bulletPoints: [
    "[DRY RUN] Premium anti-burst PVC material for safe, effective workouts",
    "[DRY RUN] Perfect size for Pilates, yoga, barre, and physical therapy",
    "[DRY RUN] Slip-resistant textured surface for enhanced grip",
    "[DRY RUN] Easy-inflate design with included straw pump",
    "[DRY RUN] Trusted by studio professionals and home practitioners",
  ],
  description:
    "[DRY RUN] Elevate your Pilates practice with this premium mini ball. Designed for mindful movement and core activation, it brings studio-quality precision to every workout.",
});

export async function generateText(prompt: string): Promise<string> {
  const config = getConfig();

  if (config.dryRun) {
    console.log("[Gemini text] Dry run mode — returning mock response");
    return DRY_RUN_RESPONSE;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Gemini text API error ${response.status}:`, body);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Unexpected Gemini response:", JSON.stringify(data, null, 2));
    throw new Error("No text in Gemini response");
  }

  return text;
}
