import { describe, it, expect } from "vitest";
import {
  PRODUCT_CATEGORIES,
  CATEGORY_PROFILES,
  getCategoryProfile,
  buildProductFromId,
  normalizeProductCategory,
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

describe("normalizeProductCategory", () => {
  it("maps known slugs case-insensitively", () => {
    expect(normalizeProductCategory("Fitness")).toBe("fitness");
    expect(normalizeProductCategory("  FITNESS  ")).toBe("fitness");
  });

  it("falls back to generic for legacy free-text", () => {
    expect(normalizeProductCategory("Pilates Accessories")).toBe("generic");
  });

  it("treats empty as generic", () => {
    expect(normalizeProductCategory("")).toBe("generic");
    expect(normalizeProductCategory(null)).toBe("generic");
    expect(normalizeProductCategory(undefined)).toBe("generic");
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

  it("falls back to generic for unknown Firestore strings", () => {
    const profile = getCategoryProfile("Pilates Accessories");
    expect(profile).toEqual(CATEGORY_PROFILES.generic);
    expect(profile.showWithPerson).toBe(false);
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

  it("normalizes unknown category strings to generic", () => {
    const product = buildProductFromId("ball", "/data", "Pilates Accessories");
    expect(product.category).toBe("generic");
  });
});
