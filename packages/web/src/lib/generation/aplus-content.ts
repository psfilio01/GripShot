export interface AplusModule {
  id: string;
  name: string;
  description: string;
  amazonModuleType: string;
  fields: string[];
}

export const APLUS_MODULES: AplusModule[] = [
  {
    id: "hero-banner",
    name: "Hero Banner",
    description:
      "Full-width hero image with headline and body text. The centerpiece of your A+ page.",
    amazonModuleType: "STANDARD_HEADER_IMAGE_TEXT",
    fields: ["headline", "body", "imageDirection"],
  },
  {
    id: "feature-highlights",
    name: "Feature Highlights",
    description:
      "Three or four key features with icons/images and short descriptions.",
    amazonModuleType: "STANDARD_THREE_IMAGE_TEXT",
    fields: ["features"],
  },
  {
    id: "comparison-chart",
    name: "Comparison Chart",
    description:
      "Side-by-side product comparison table highlighting differences across variants or competitors.",
    amazonModuleType: "STANDARD_COMPARISON_TABLE",
    fields: ["columns", "rows"],
  },
  {
    id: "brand-story",
    name: "Brand Story",
    description:
      "Tell your brand story with a split image + text layout. Builds trust and emotional connection.",
    amazonModuleType: "STANDARD_IMAGE_TEXT_OVERLAY",
    fields: ["headline", "body", "values"],
  },
  {
    id: "tech-specs",
    name: "Technical Specifications",
    description:
      "Clean spec table with product dimensions, materials, and key measurements.",
    amazonModuleType: "STANDARD_TECH_SPECS",
    fields: ["specs"],
  },
];

export function getModuleById(id: string): AplusModule | undefined {
  return APLUS_MODULES.find((m) => m.id === id);
}

export interface AplusGenerationInput {
  moduleId: string;
  productName: string;
  productDescription: string;
  brandName: string;
  brandDna: string;
  additionalNotes?: string;
}

export function buildAplusPrompt(input: AplusGenerationInput): string {
  const mod = getModuleById(input.moduleId);
  if (!mod) {
    throw new Error(`Unknown A+ module: ${input.moduleId}`);
  }

  const sections = [
    `You are an expert Amazon A+ content copywriter specializing in premium brand storytelling.`,
    ``,
    `Generate content for an Amazon A+ "${mod.name}" module (${mod.amazonModuleType}).`,
    `Module description: ${mod.description}`,
    ``,
    `Product: ${input.productName}`,
    `Product description: ${input.productDescription}`,
    ``,
    `Brand: ${input.brandName}`,
    `Brand DNA: ${input.brandDna}`,
  ];

  if (input.additionalNotes) {
    sections.push(``, `Additional notes: ${input.additionalNotes}`);
  }

  sections.push(
    ``,
    `Requirements:`,
    `- Write in a tone that matches the brand DNA`,
    `- Keep text concise and scannable — Amazon shoppers skim`,
    `- Use benefit-driven language, not just features`,
    `- All text must be suitable for Amazon A+ content guidelines`,
    `- Do not use competitor brand names`,
    ``,
  );

  switch (mod.id) {
    case "hero-banner":
      sections.push(
        `Return JSON with:`,
        `{`,
        `  "headline": "short punchy headline (max 80 chars)",`,
        `  "body": "2-3 sentences of engaging body copy",`,
        `  "imageDirection": "art direction for the hero image (describe ideal composition, mood, colors)"`,
        `}`,
      );
      break;
    case "feature-highlights":
      sections.push(
        `Return JSON with:`,
        `{`,
        `  "features": [`,
        `    { "title": "feature title", "body": "1-2 sentence description" }`,
        `  ]`,
        `}`,
        `Include exactly 3 features.`,
      );
      break;
    case "comparison-chart":
      sections.push(
        `Return JSON with:`,
        `{`,
        `  "columns": ["Product Variant 1", "Product Variant 2", "Product Variant 3"],`,
        `  "rows": [`,
        `    { "attribute": "attribute name", "values": ["value1", "value2", "value3"] }`,
        `  ]`,
        `}`,
        `Include 4-6 comparison rows with meaningful differentiators.`,
      );
      break;
    case "brand-story":
      sections.push(
        `Return JSON with:`,
        `{`,
        `  "headline": "emotive brand story headline",`,
        `  "body": "3-4 sentences telling the brand story",`,
        `  "values": ["brand value 1", "brand value 2", "brand value 3"]`,
        `}`,
      );
      break;
    case "tech-specs":
      sections.push(
        `Return JSON with:`,
        `{`,
        `  "specs": [`,
        `    { "label": "spec name", "value": "spec value" }`,
        `  ]`,
        `}`,
        `Include 5-8 relevant specifications. Use the product description to extract real data.`,
      );
      break;
  }

  sections.push(``, `Return ONLY valid JSON, no markdown fences or extra text.`);

  return sections.join("\n");
}

export function parseAplusResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();

  const closedFence = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (closedFence) {
    cleaned = closedFence[1].trim();
  } else {
    const openFence = cleaned.match(/```(?:json)?\s*\n?([\s\S]+)/);
    if (openFence) {
      cleaned = openFence[1].trim();
    }
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to repair truncated JSON
    let repaired = cleaned;
    const trailingQuotes = (repaired.match(/"/g) ?? []).length;
    if (trailingQuotes % 2 !== 0) repaired += '"';
    const openBrackets = (repaired.match(/\[/g) ?? []).length - (repaired.match(/\]/g) ?? []).length;
    for (let i = 0; i < openBrackets; i++) repaired += "]";
    const openBraces = (repaired.match(/\{/g) ?? []).length - (repaired.match(/\}/g) ?? []).length;
    for (let i = 0; i < openBraces; i++) repaired += "}";

    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error(`Failed to parse A+ content response as JSON. Raw: ${raw.slice(0, 500)}`);
    }
  }
}
