import { describe, it, expect } from "vitest";
import { CreateColorSchema, ProductColorSchema } from "./product-colors";

describe("ProductColorSchema", () => {
  it("accepts a valid color", () => {
    const result = ProductColorSchema.safeParse({
      id: "color-1",
      name: "Navy Blue",
      hex: "#1A2B3C",
      notes: "Main variant",
      sku: "NB-001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex codes", () => {
    const cases = ["red", "#GGG000", "1A2B3C", "#12345", "#1234567", ""];
    for (const hex of cases) {
      const result = ProductColorSchema.safeParse({
        id: "c1",
        name: "Bad",
        hex,
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts valid hex codes (case insensitive)", () => {
    const cases = ["#000000", "#FFFFFF", "#ff5733", "#aAbBcC"];
    for (const hex of cases) {
      const result = ProductColorSchema.safeParse({
        id: "c1",
        name: "Good",
        hex,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty name", () => {
    const result = ProductColorSchema.safeParse({
      id: "c1",
      name: "",
      hex: "#000000",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateColorSchema", () => {
  it("does not require id field", () => {
    const result = CreateColorSchema.safeParse({
      name: "Sage Green",
      hex: "#8F9D6A",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("id");
  });

  it("defaults notes and sku to empty string", () => {
    const result = CreateColorSchema.safeParse({
      name: "Sage Green",
      hex: "#8F9D6A",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("");
      expect(result.data.sku).toBe("");
    }
  });
});
