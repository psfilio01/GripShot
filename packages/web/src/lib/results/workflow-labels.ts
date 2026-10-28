export const WORKFLOW_LABELS: Record<string, string> = {
  NEUTRAL_PRODUCT_SHOT: "Product shot",
  AMAZON_LIFESTYLE_SHOT: "Lifestyle",
  LIFESTYLE: "Lifestyle",
  MAIN_IMAGE: "Main image",
  SCALE_REFERENCE: "Scale ref",
  DETAIL_CLOSEUP: "Detail",
  A_PLUS_VISUAL: "A+ Visual",
  HERO_LOCK_RECOLOR: "Color variant",
  EXTERNAL_HERO_UPLOAD: "External Hero",
  MAIN_WHITE_BACKGROUND: "Main · white background",
};

export function workflowLabel(wt: string): string {
  return WORKFLOW_LABELS[wt] ?? wt;
}
