import { describe, it, expect } from "vitest";
import {
  IMAGE_CATEGORIES,
  DEFAULT_CATEGORY,
  isValidCategory,
  getCategoryLabel,
} from "./categories";

describe("IMAGE_CATEGORIES", () => {
  it("has at least 4 categories", () => {
    expect(IMAGE_CATEGORIES.length).toBeGreaterThanOrEqual(4);
  });

  it("each category has a unique id", () => {
    const ids = IMAGE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isValidCategory", () => {
  it("returns true for known categories", () => {
    expect(isValidCategory("primary")).toBe(true);
    expect(isValidCategory("logo")).toBe(true);
    expect(isValidCategory("packaging")).toBe(true);
  });

  it("returns false for unknown categories", () => {
    expect(isValidCategory("unknown")).toBe(false);
    expect(isValidCategory("")).toBe(false);
  });
});

describe("getCategoryLabel", () => {
  it("returns the label for a known category", () => {
    expect(getCategoryLabel("primary")).toBe("Primary");
    expect(getCategoryLabel("logo")).toBe("Logo");
  });

  it("returns the id for an unknown category", () => {
    expect(getCategoryLabel("unknown")).toBe("unknown");
  });
});

describe("DEFAULT_CATEGORY", () => {
  it("is primary", () => {
    expect(DEFAULT_CATEGORY).toBe("primary");
  });
});
