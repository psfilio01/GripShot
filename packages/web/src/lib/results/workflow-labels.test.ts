import { describe, expect, it } from "vitest";
import { workflowLabel, WORKFLOW_LABELS } from "./workflow-labels";

describe("workflowLabel", () => {
  it("returns correct labels for all defined workflow types", () => {
    expect(workflowLabel("NEUTRAL_PRODUCT_SHOT")).toBe("Product shot");
    expect(workflowLabel("AMAZON_LIFESTYLE_SHOT")).toBe("Lifestyle");
    expect(workflowLabel("LIFESTYLE")).toBe("Lifestyle");
    expect(workflowLabel("MAIN_IMAGE")).toBe("Main image");
    expect(workflowLabel("SCALE_REFERENCE")).toBe("Scale ref");
    expect(workflowLabel("DETAIL_CLOSEUP")).toBe("Detail");
    expect(workflowLabel("A_PLUS_VISUAL")).toBe("A+ Visual");
    expect(workflowLabel("HERO_LOCK_RECOLOR")).toBe("Color variant");
    expect(workflowLabel("EXTERNAL_HERO_UPLOAD")).toBe("External Hero");
  });

  it("falls back to the raw value for unknown types", () => {
    expect(workflowLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
    expect(workflowLabel("")).toBe("");
  });

  it("WORKFLOW_LABELS covers all expected keys", () => {
    const expectedKeys = [
      "NEUTRAL_PRODUCT_SHOT",
      "AMAZON_LIFESTYLE_SHOT",
      "LIFESTYLE",
      "MAIN_IMAGE",
      "SCALE_REFERENCE",
      "DETAIL_CLOSEUP",
      "A_PLUS_VISUAL",
      "HERO_LOCK_RECOLOR",
      "EXTERNAL_HERO_UPLOAD",
    ];
    for (const key of expectedKeys) {
      expect(WORKFLOW_LABELS).toHaveProperty(key);
    }
  });
});
