import { describe, it, expect } from "vitest";
import { z } from "zod";

const CreateProductSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.string().max(200).default(""),
  description: z.string().max(2000).default(""),
});

describe("CreateProductSchema validation", () => {
  it("accepts a valid product", () => {
    const result = CreateProductSchema.safeParse({
      brandId: "brand_1",
      name: "Pilates Mini Ball",
      category: "Pilates Accessories",
      description: "A 23cm soft PVC mini ball",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing brandId", () => {
    const result = CreateProductSchema.safeParse({
      name: "Ball",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateProductSchema.safeParse({
      brandId: "b1",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields", () => {
    const result = CreateProductSchema.parse({
      brandId: "b1",
      name: "Grip Socks",
    });
    expect(result.category).toBe("");
    expect(result.description).toBe("");
  });
});
