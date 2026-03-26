import { describe, it, expect, vi } from "vitest";
import { buildPrompt, type BuildPromptArgs } from "./promptBuilder";
import type { Product } from "../domain/product";
import type { ReferenceImage } from "./referenceImageLoader";

vi.mock("nanoid", () => ({ nanoid: () => "test-id" }));

function makeArgs(overrides: Partial<BuildPromptArgs> = {}): BuildPromptArgs {
  const product: Product = {
    id: "test-product",
    name: "Test Product",
    basePath: "/data/products/test-product",
    ...overrides.product,
  };
  const references: ReferenceImage[] = overrides.references ?? [
    { path: "/data/products/test-product/reference/img.jpg" },
  ];
  return {
    workflowType: overrides.workflowType ?? "NEUTRAL_PRODUCT_SHOT",
    brandRules: overrides.brandRules ?? null,
    ...overrides,
    product,
    references,
  };
}

describe("buildPrompt — backward compatibility", () => {
  it("produces a NEUTRAL_PRODUCT_SHOT prompt", () => {
    const result = buildPrompt(makeArgs({ workflowType: "NEUTRAL_PRODUCT_SHOT" }));
    expect(result.workflowType).toBe("NEUTRAL_PRODUCT_SHOT");
    expect(result.templateId).toBe("neutral_product_shot_v1");
    expect(result.text).toContain("neutral product shot");
  });

  it("produces an AMAZON_LIFESTYLE_SHOT prompt", () => {
    const result = buildPrompt(makeArgs({ workflowType: "AMAZON_LIFESTYLE_SHOT" }));
    expect(result.workflowType).toBe("AMAZON_LIFESTYLE_SHOT");
    expect(result.templateId).toBe("amazon_lifestyle_shot_v1");
    expect(result.text).toContain("Amazon-style product image");
  });

  it("LIFESTYLE routes to the same builder as AMAZON_LIFESTYLE_SHOT", () => {
    const result = buildPrompt(makeArgs({ workflowType: "LIFESTYLE" }));
    expect(result.workflowType).toBe("LIFESTYLE");
    expect(result.templateId).toBe("amazon_lifestyle_shot_v1");
  });
});

describe("buildPrompt — MAIN_IMAGE", () => {
  it("produces a MAIN_IMAGE prompt with white background instructions", () => {
    const result = buildPrompt(makeArgs({ workflowType: "MAIN_IMAGE" }));
    expect(result.workflowType).toBe("MAIN_IMAGE");
    expect(result.text).toContain("pure white background");
    expect(result.text).toContain("Amazon Main Image");
  });

  it("includes composition template blocks", () => {
    const result = buildPrompt(makeArgs({ workflowType: "MAIN_IMAGE" }));
    expect(result.text).toContain("Composition:");
    expect(result.text).toContain("Camera:");
    expect(result.text).toContain("Lighting:");
  });

  it("uses category-specific template for furniture", () => {
    const product: Product = {
      id: "bookshelf",
      name: "Bookshelf",
      basePath: "/data/products/bookshelf",
      category: "furniture",
    };
    const result = buildPrompt(makeArgs({ workflowType: "MAIN_IMAGE", product }));
    expect(result.templateId).toBe("hero_isolated_large");
  });

  it("adds material focus hint for beauty category", () => {
    const product: Product = {
      id: "lipstick",
      name: "Lipstick",
      basePath: "/data/products/lipstick",
      category: "beauty",
    };
    const result = buildPrompt(makeArgs({ workflowType: "MAIN_IMAGE", product }));
    expect(result.text).toContain("material quality");
  });
});

describe("buildPrompt — SCALE_REFERENCE", () => {
  it("produces a scale reference prompt", () => {
    const result = buildPrompt(makeArgs({ workflowType: "SCALE_REFERENCE" }));
    expect(result.workflowType).toBe("SCALE_REFERENCE");
    expect(result.text).toContain("physical size");
  });

  it("uses hand reference for small items", () => {
    const product: Product = {
      id: "phone-case",
      name: "Phone Case",
      basePath: "/data/products/phone-case",
      category: "handheld",
    };
    const result = buildPrompt(makeArgs({ workflowType: "SCALE_REFERENCE", product }));
    expect(result.text).toContain("held in a human hand");
  });

  it("uses person reference for large items", () => {
    const product: Product = {
      id: "garden-table",
      name: "Garden Table",
      basePath: "/data/products/garden-table",
      category: "furniture",
    };
    const result = buildPrompt(makeArgs({ workflowType: "SCALE_REFERENCE", product }));
    expect(result.text).toContain("standing adult person");
  });
});

describe("buildPrompt — DETAIL_CLOSEUP", () => {
  it("produces a detail closeup prompt", () => {
    const result = buildPrompt(makeArgs({ workflowType: "DETAIL_CLOSEUP" }));
    expect(result.workflowType).toBe("DETAIL_CLOSEUP");
    expect(result.text).toContain("close-up detail shot");
    expect(result.text).toContain("texture");
  });

  it("adds extra material emphasis for wearable category", () => {
    const product: Product = {
      id: "watch-band",
      name: "Watch Band",
      basePath: "/data/products/watch-band",
      category: "wearable",
    };
    const result = buildPrompt(makeArgs({ workflowType: "DETAIL_CLOSEUP", product }));
    expect(result.text).toContain("material emphasis");
  });
});

describe("buildPrompt — A_PLUS_VISUAL", () => {
  it("produces an A+ visual prompt", () => {
    const result = buildPrompt(makeArgs({ workflowType: "A_PLUS_VISUAL" }));
    expect(result.workflowType).toBe("A_PLUS_VISUAL");
    expect(result.text).toContain("A+ Content");
    expect(result.text).toContain("aspirational");
  });

  it("includes person hint for fitness category", () => {
    const product: Product = {
      id: "resistance-band",
      name: "Resistance Band",
      basePath: "/data/products/resistance-band",
      category: "fitness",
    };
    const result = buildPrompt(makeArgs({ workflowType: "A_PLUS_VISUAL", product }));
    expect(result.text).toContain("person may partially appear");
  });

  it("includes context hint for furniture category", () => {
    const product: Product = {
      id: "desk-lamp",
      name: "Desk Lamp",
      basePath: "/data/products/desk-lamp",
      category: "decor",
    };
    const result = buildPrompt(makeArgs({ workflowType: "A_PLUS_VISUAL", product }));
    expect(result.text).toContain("aspirational environment");
  });
});

describe("buildPrompt — hard rules integration", () => {
  it("includes product and global hard rules in all new types", () => {
    const types: Array<BuildPromptArgs["workflowType"]> = [
      "MAIN_IMAGE", "SCALE_REFERENCE", "DETAIL_CLOSEUP", "A_PLUS_VISUAL",
    ];
    for (const wt of types) {
      const result = buildPrompt(makeArgs({
        workflowType: wt,
        productHardRules: { text: "PRODUCT_RULE_MARKER", source: "product" },
        globalHardRules: { text: "GLOBAL_RULE_MARKER", source: "global" },
      }));
      expect(result.text).toContain("PRODUCT_RULE_MARKER");
      expect(result.text).toContain("GLOBAL_RULE_MARKER");
    }
  });

  it("includes brand DNA in all new types", () => {
    const types: Array<BuildPromptArgs["workflowType"]> = [
      "MAIN_IMAGE", "SCALE_REFERENCE", "DETAIL_CLOSEUP", "A_PLUS_VISUAL",
    ];
    for (const wt of types) {
      const result = buildPrompt(makeArgs({
        workflowType: wt,
        brandDna: { brandId: "test", brandName: "TestBrand", text: "DNA_MARKER" },
      }));
      expect(result.text).toContain("DNA_MARKER");
    }
  });
});
