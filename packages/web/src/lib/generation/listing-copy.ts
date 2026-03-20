import type { BrandDoc, ProductDoc } from "@/lib/db/types";

export interface ListingCopyInput {
  product: ProductDoc & { id: string };
  brand: BrandDoc & { id: string };
  keywords?: string;
  additionalNotes?: string;
}

export interface ListingCopyResult {
  title: string;
  bulletPoints: string[];
  description: string;
}

export function buildListingCopyPrompt(input: ListingCopyInput): string {
  const sections: string[] = [];

  sections.push(
    `You are an expert Amazon listing copywriter. Generate an optimized product listing for the following product.`,
  );

  sections.push(`\n## Product\n- Name: ${input.product.name}`);
  if (input.product.category) {
    sections.push(`- Category: ${input.product.category}`);
  }
  if (input.product.description) {
    sections.push(`- Description: ${input.product.description}`);
  }

  sections.push(`\n## Brand: ${input.brand.name}`);
  if (input.brand.dna) {
    sections.push(`Brand DNA: ${input.brand.dna}`);
  }
  if (input.brand.targetAudience) {
    sections.push(`Target audience: ${input.brand.targetAudience}`);
  }
  if (input.brand.tone) {
    sections.push(`Tone: ${input.brand.tone}`);
  }

  if (input.keywords) {
    sections.push(`\n## Keywords to include\n${input.keywords}`);
  }

  if (input.additionalNotes) {
    sections.push(`\n## Additional notes\n${input.additionalNotes}`);
  }

  sections.push(`\n## Output format
Return a JSON object with these exact fields:
{
  "title": "Product title (max 200 characters, keyword-rich)",
  "bulletPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "description": "Product description (2-3 paragraphs, conversion-focused)"
}

Requirements:
- Optimize for Amazon search and conversion
- Reflect the brand DNA and tone
- Use the target audience's language
- Include relevant keywords naturally
- Bullet points should highlight key benefits and features
- Title must follow Amazon's style guidelines
- Description should build trust and desire
- Return only the JSON, no other text`);

  return sections.join("\n");
}

export function parseListingCopyResponse(raw: string): ListingCopyResult {
  let text = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in Gemini response. Raw:", raw.slice(0, 500));
    throw new Error("No JSON found in response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.title || !Array.isArray(parsed.bulletPoints) || !parsed.description) {
    throw new Error("Response missing required fields");
  }

  return {
    title: String(parsed.title),
    bulletPoints: parsed.bulletPoints.map(String),
    description: String(parsed.description),
  };
}
