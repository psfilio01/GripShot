import { describe, it, expect } from "vitest";
import {
  findCompositionTemplate,
  getAllCompositionTemplates,
  type CompositionTemplate,
} from "./compositionTemplates";
import type { WorkflowType } from "../types/api";

describe("getAllCompositionTemplates", () => {
  it("returns a non-empty array", () => {
    const all = getAllCompositionTemplates();
    expect(all.length).toBeGreaterThan(0);
  });

  it("every template has required fields", () => {
    for (const t of getAllCompositionTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.applicableTo.length).toBeGreaterThan(0);
      expect(t.categoryHints.length).toBeGreaterThan(0);
      expect(t.promptBlocks.composition).toBeTruthy();
      expect(t.promptBlocks.camera).toBeTruthy();
      expect(t.promptBlocks.lighting).toBeTruthy();
    }
  });
});

describe("findCompositionTemplate", () => {
  it("returns a template for MAIN_IMAGE", () => {
    const t = findCompositionTemplate("MAIN_IMAGE");
    expect(t).not.toBeNull();
    expect(t!.applicableTo).toContain("MAIN_IMAGE");
  });

  it("returns a template for DETAIL_CLOSEUP", () => {
    const t = findCompositionTemplate("DETAIL_CLOSEUP");
    expect(t).not.toBeNull();
    expect(t!.applicableTo).toContain("DETAIL_CLOSEUP");
  });

  it("returns a template for SCALE_REFERENCE", () => {
    const t = findCompositionTemplate("SCALE_REFERENCE");
    expect(t).not.toBeNull();
  });

  it("returns a template for A_PLUS_VISUAL", () => {
    const t = findCompositionTemplate("A_PLUS_VISUAL");
    expect(t).not.toBeNull();
  });

  it("returns a template for LIFESTYLE", () => {
    const t = findCompositionTemplate("LIFESTYLE");
    expect(t).not.toBeNull();
    expect(t!.applicableTo).toContain("LIFESTYLE");
  });

  it("returns a template for AMAZON_LIFESTYLE_SHOT", () => {
    const t = findCompositionTemplate("AMAZON_LIFESTYLE_SHOT");
    expect(t).not.toBeNull();
    expect(t!.applicableTo).toContain("AMAZON_LIFESTYLE_SHOT");
  });

  it("selects category-specific template for MAIN_IMAGE + furniture", () => {
    const t = findCompositionTemplate("MAIN_IMAGE", "furniture");
    expect(t).not.toBeNull();
    expect(t!.id).toBe("hero_isolated_large");
  });

  it("selects category-specific template for MAIN_IMAGE + handheld", () => {
    const t = findCompositionTemplate("MAIN_IMAGE", "handheld");
    expect(t).not.toBeNull();
    expect(t!.id).toBe("hero_isolated");
  });

  it("selects scale_hand_held for SCALE_REFERENCE + beauty", () => {
    const t = findCompositionTemplate("SCALE_REFERENCE", "beauty");
    expect(t).not.toBeNull();
    expect(t!.id).toBe("scale_hand_held");
  });

  it("selects scale_person_standing for SCALE_REFERENCE + furniture", () => {
    const t = findCompositionTemplate("SCALE_REFERENCE", "furniture");
    expect(t).not.toBeNull();
    expect(t!.id).toBe("scale_person_standing");
  });

  it("falls back to first template when category has no specific match", () => {
    const t = findCompositionTemplate("MAIN_IMAGE", "outdoor");
    expect(t).not.toBeNull();
    expect(t!.categoryHints).toContain("outdoor");
  });

  it("returns null for NEUTRAL_PRODUCT_SHOT (no template defined)", () => {
    const t = findCompositionTemplate("NEUTRAL_PRODUCT_SHOT");
    expect(t).toBeNull();
  });
});
