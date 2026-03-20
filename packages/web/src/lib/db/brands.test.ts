import { describe, it, expect } from "vitest";
import { z } from "zod";

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  isPrivateLabel: z.boolean(),
  dna: z.string().max(2000).default(""),
  targetAudience: z.string().max(500).default(""),
  productCategory: z.string().max(200).default(""),
  tone: z.string().max(500).default(""),
});

describe("CreateBrandSchema validation", () => {
  it("accepts a valid brand", () => {
    const result = CreateBrandSchema.safeParse({
      name: "AuréLéa",
      isPrivateLabel: true,
      dna: "Quiet luxury in movement",
      targetAudience: "Women 25-40",
      productCategory: "Pilates accessories",
      tone: "Elegant but approachable",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateBrandSchema.safeParse({
      name: "",
      isPrivateLabel: false,
    });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields to empty string", () => {
    const result = CreateBrandSchema.parse({
      name: "Test Brand",
      isPrivateLabel: false,
    });
    expect(result.dna).toBe("");
    expect(result.targetAudience).toBe("");
    expect(result.tone).toBe("");
  });

  it("rejects name longer than 100 chars", () => {
    const result = CreateBrandSchema.safeParse({
      name: "A".repeat(101),
      isPrivateLabel: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dna longer than 2000 chars", () => {
    const result = CreateBrandSchema.safeParse({
      name: "X",
      isPrivateLabel: true,
      dna: "A".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
