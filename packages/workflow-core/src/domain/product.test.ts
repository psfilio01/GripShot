import { describe, it, expect } from "vitest";
import {
  PRODUCT_CATEGORIES,
  CATEGORY_PROFILES,
  getCategoryProfile,
  buildProductFromId,
  type ProductCategory,
} from "./product";

describe("ProductCategory", () => {
  it("defines all expected categories", () => {
    const expected: ProductCategory[] = [
      "handheld", "wearable", "furniture", "outdoor",
      "kitchen", "beauty", "decor", "fitness", "generic",
    ];
    expect([...PRODUCT_CATEGORIES]).toEqual(expected);
  });

  it("has a profile for every category", () => {
    for (const cat of PRODUCT_CATEGORIES) {
      expect(CATEGORY_PROFILES[cat]).toBeDefined();
      expect(CATEGORY_PROFILES[cat]).toHaveProperty("typicalScale");
      expect(CATEGORY_PROFILES[cat]).toHaveProperty("showWithPerson");
      expect(CATEGORY_PROFILES[cat]).toHaveProperty("detailShotsRelevant");
      expect(CATEGORY_PROFILES[cat]).toHaveProperty("materialFocus");
      expect(CATEGORY_PROFILES[cat]).toHaveProperty("contextNeeded");
    }
  });
});

describe("getCategoryProfile", () => {
  it("returns the correct profile for a known category", () => {
    const profile = getCategoryProfile("handheld");
    expect(profile.typicalScale).toBe("small");
    expect(profile.showWithPerson).toBe(true);
  });

  it("falls back to generic when category is undefined", () => {
    const profile = getCategoryProfile(undefined);
    expect(profile).toEqual(CATEGORY_PROFILES.generic);
  });

  it("returns generic profile for 'generic' category", () => {
    expect(getCategoryProfile("generic")).toBe(CATEGORY_PROFILES.generic);
  });

  it("furniture is large-scale with context needed", () => {
    const profile = getCategoryProfile("furniture");
    expect(profile.typicalScale).toBe("large");
    expect(profile.contextNeeded).toBe(true);
    expect(profile.showWithPerson).toBe(false);
  });
});

describe("buildProductFromId", () => {
  it("builds a product without category (backward compat)", () => {
    const product = buildProductFromId("test-ball", "/data");
    expect(product.id).toBe("test-ball");
    expect(product.basePath).toBe("/data/products/test-ball");
    expect(product.category).toBeUndefined();
  });

  it("builds a product with category", () => {
    const product = buildProductFromId("yoga-mat", "/data", "fitness");
    expect(product.category).toBe("fitness");
  });
});
