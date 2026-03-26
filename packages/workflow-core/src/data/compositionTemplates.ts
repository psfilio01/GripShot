import type { WorkflowType } from "../types/api";
import type { ProductCategory } from "../domain/product";

export interface CompositionTemplate {
  id: string;
  name: string;
  applicableTo: WorkflowType[];
  categoryHints: ProductCategory[];
  promptBlocks: {
    composition: string;
    camera: string;
    lighting: string;
  };
}

const TEMPLATES: CompositionTemplate[] = [
  // ── MAIN_IMAGE ──────────────────────────────────────────────────────────
  {
    id: "hero_isolated",
    name: "Freigestelltes Hero-Produkt",
    applicableTo: ["MAIN_IMAGE"],
    categoryHints: ["handheld", "beauty", "kitchen", "wearable", "fitness", "generic"],
    promptBlocks: {
      composition:
        "Centered product, isolated on pure white background (#FFFFFF). " +
        "Product fills approximately 85% of the frame. No props, no people, no text overlays. " +
        "Amazon Main Image compliant: pure white background, product only.",
      camera:
        "Straight-on or slight 3/4 angle, eye-level perspective. " +
        "Sharp focus across the entire product with deep depth of field.",
      lighting:
        "Even, diffused studio lighting with soft shadows. " +
        "No harsh reflections. Slight contact shadow beneath the product for grounding.",
    },
  },
  {
    id: "hero_isolated_large",
    name: "Freigestelltes Hero-Produkt (gross)",
    applicableTo: ["MAIN_IMAGE"],
    categoryHints: ["furniture", "outdoor", "decor"],
    promptBlocks: {
      composition:
        "Product centered on pure white background (#FFFFFF), shown at a natural viewing angle. " +
        "Full product visible with adequate breathing room. Amazon Main Image compliant.",
      camera:
        "Slight elevation angle (15-25 degrees) to show top surface and depth. " +
        "Deep depth of field, entire product in sharp focus.",
      lighting:
        "Large soft-box style lighting. Even illumination with gentle gradient shadow on floor. " +
        "No reflections that obscure material details.",
    },
  },

  // ── LIFESTYLE / AMAZON_LIFESTYLE_SHOT ───────────────────────────────────
  {
    id: "lifestyle_active",
    name: "Lifestyle mit Person (aktiv)",
    applicableTo: ["LIFESTYLE", "AMAZON_LIFESTYLE_SHOT"],
    categoryHints: ["fitness", "handheld", "wearable", "beauty", "generic"],
    promptBlocks: {
      composition:
        "Product in active use by a person. Person and product are the focal point. " +
        "Rule of thirds placement. Natural, candid feel.",
      camera:
        "Medium shot, slight elevation or eye-level. Shallow-to-medium depth of field " +
        "to softly separate subject from background while keeping product sharp.",
      lighting:
        "Natural-looking directional light with warm tone. Soft key light, subtle fill. " +
        "Avoid flat lighting; create gentle dimensionality.",
    },
  },
  {
    id: "lifestyle_contextual",
    name: "Lifestyle im Kontext",
    applicableTo: ["LIFESTYLE", "AMAZON_LIFESTYLE_SHOT"],
    categoryHints: ["furniture", "outdoor", "kitchen", "decor"],
    promptBlocks: {
      composition:
        "Product placed in a realistic environment that suggests everyday use. " +
        "Supporting props allowed but must not compete with the product for attention.",
      camera:
        "Wide-to-medium shot capturing environment context. " +
        "Product in the visual power position (left or right third).",
      lighting:
        "Ambient, environment-appropriate lighting. Warm interior light for indoor scenes, " +
        "natural daylight for outdoor. Soft shadows that ground the product.",
    },
  },

  // ── SCALE_REFERENCE ─────────────────────────────────────────────────────
  {
    id: "scale_hand_held",
    name: "Groessenreferenz: in der Hand",
    applicableTo: ["SCALE_REFERENCE"],
    categoryHints: ["handheld", "beauty", "kitchen", "wearable", "generic"],
    promptBlocks: {
      composition:
        "Product held in a human hand to communicate real-world scale. " +
        "Clean, uncluttered composition. Hand and product are the only subjects.",
      camera:
        "Close-to-medium shot, slightly above eye-level. " +
        "Product and hand both in sharp focus.",
      lighting:
        "Bright, even studio lighting. Neutral white or light grey background. " +
        "Soft shadow under the hand for depth.",
    },
  },
  {
    id: "scale_person_standing",
    name: "Groessenreferenz: neben Person",
    applicableTo: ["SCALE_REFERENCE"],
    categoryHints: ["furniture", "outdoor", "fitness", "decor"],
    promptBlocks: {
      composition:
        "Product shown next to a standing person to communicate scale. " +
        "Person positioned beside or slightly behind the product. " +
        "Clean neutral background.",
      camera:
        "Full-body or 3/4 shot from a slight distance. " +
        "Deep depth of field, both person and product fully sharp.",
      lighting:
        "Even studio lighting, soft and diffused. " +
        "Minimal shadows, neutral color temperature.",
    },
  },

  // ── DETAIL_CLOSEUP ──────────────────────────────────────────────────────
  {
    id: "detail_material",
    name: "Detailaufnahme: Material und Textur",
    applicableTo: ["DETAIL_CLOSEUP"],
    categoryHints: [
      "handheld", "wearable", "furniture", "kitchen",
      "beauty", "decor", "fitness", "outdoor", "generic",
    ],
    promptBlocks: {
      composition:
        "Extreme close-up focusing on material quality, texture, stitching, or finish. " +
        "Fill the frame with the detail area. No full product view needed.",
      camera:
        "Macro-style shot with shallow depth of field. " +
        "Sharp focus on the texture/detail zone, soft bokeh falloff.",
      lighting:
        "Raking or side-angled light to emphasise surface texture and depth. " +
        "Slight specular highlights on glossy materials. Warm, natural tone.",
    },
  },

  // ── A_PLUS_VISUAL ───────────────────────────────────────────────────────
  {
    id: "a_plus_hero",
    name: "A+ Content: Premium Visual",
    applicableTo: ["A_PLUS_VISUAL"],
    categoryHints: ["handheld", "beauty", "wearable", "fitness", "kitchen", "generic"],
    promptBlocks: {
      composition:
        "Premium lifestyle visual for Amazon A+ Content. " +
        "Product is hero but may include partial model (hands, silhouette) or styled props. " +
        "Aspirational, editorial feel. Suitable for banner-width layouts.",
      camera:
        "Dynamic angle: slight low angle or creative 3/4 view for drama. " +
        "Medium depth of field to create visual hierarchy.",
      lighting:
        "Cinematic, brand-consistent lighting. Warm highlights, controlled contrast. " +
        "Subtle gradient or tonal background that complements the product color.",
    },
  },
  {
    id: "a_plus_room_scene",
    name: "A+ Content: Raum-Szene",
    applicableTo: ["A_PLUS_VISUAL"],
    categoryHints: ["furniture", "decor", "outdoor"],
    promptBlocks: {
      composition:
        "Product styled in an aspirational room or outdoor setting. " +
        "Supporting decor allowed to create atmosphere. " +
        "Wide aspect ratio friendly for A+ module banners.",
      camera:
        "Wide shot with the product as the clear focal point. " +
        "Slight depth of field to separate product from environment.",
      lighting:
        "Natural interior or golden-hour outdoor light. " +
        "Warm, inviting tones. Shadows create depth without obscuring product.",
    },
  },
];

/**
 * Find the best-matching composition template for a given workflow type and
 * optional product category. Falls back gracefully:
 * 1. Exact match on workflowType + category
 * 2. Any template for workflowType (ignoring category)
 * 3. null if no template matches the workflowType at all
 */
export function findCompositionTemplate(
  workflowType: WorkflowType,
  category?: ProductCategory,
): CompositionTemplate | null {
  const byWorkflow = TEMPLATES.filter((t) =>
    t.applicableTo.includes(workflowType),
  );
  if (byWorkflow.length === 0) return null;

  if (category) {
    const exact = byWorkflow.find((t) => t.categoryHints.includes(category));
    if (exact) return exact;
  }

  return byWorkflow[0];
}

/** All registered composition templates (useful for tests / introspection). */
export function getAllCompositionTemplates(): readonly CompositionTemplate[] {
  return TEMPLATES;
}
