import { describe, it, expect, beforeEach } from "vitest";
import {
  findCompositionTemplate,
  getAllCompositionTemplates,
  reloadCompositionTemplates,
} from "./compositionTemplates";
import type { WorkflowType } from "../types/api";

describe("compositionTemplates — JSON loading", () => {
  beforeEach(() => {
    reloadCompositionTemplates();
  });

  it("loads at least 5 templates from JSON files", () => {
    const all = getAllCompositionTemplates();
    expect(all.length).toBeGreaterThanOrEqual(5);
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

  it("has templates for all workflow types except NEUTRAL_PRODUCT_SHOT", () => {
    const workflowTypes: WorkflowType[] = [
      "MAIN_IMAGE", "LIFESTYLE", "AMAZON_LIFESTYLE_SHOT",
      "SCALE_REFERENCE", "DETAIL_CLOSEUP", "A_PLUS_VISUAL",
    ];
    for (const wt of workflowTypes) {
      expect(findCompositionTemplate(wt)).not.toBeNull();
    }
  });

  it("returns null for NEUTRAL_PRODUCT_SHOT (no template defined)", () => {
    expect(findCompositionTemplate("NEUTRAL_PRODUCT_SHOT")).toBeNull();
  });

  it("selects category-specific template when available", () => {
    const furniture = findCompositionTemplate("MAIN_IMAGE", "furniture");
    expect(furniture?.id).toBe("hero_isolated_large");

    const handheld = findCompositionTemplate("MAIN_IMAGE", "handheld");
    expect(handheld?.id).toBe("hero_isolated");
  });

  it("falls back to first matching template when category has no exact hit", () => {
    const result = findCompositionTemplate("DETAIL_CLOSEUP", "handheld");
    expect(result).not.toBeNull();
    expect(result?.applicableTo).toContain("DETAIL_CLOSEUP");
  });

  it("templates are sorted by id for deterministic ordering", () => {
    const all = getAllCompositionTemplates();
    const ids = all.map((t) => t.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
