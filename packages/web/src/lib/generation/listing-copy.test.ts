import { describe, it, expect } from "vitest";
import {
  buildListingCopyPrompt,
  parseListingCopyResponse,
} from "./listing-copy";
import type { Timestamp } from "firebase-admin/firestore";

const ts = {} as Timestamp;

const mockProduct = {
  id: "p1",
  name: "Pilates Mini Ball",
  brandId: "b1",
  category: "Pilates Accessories",
  description: "A 23cm soft PVC mini ball",
  status: "active" as const,
  createdAt: ts,
  updatedAt: ts,
};

const mockBrand = {
  id: "b1",
  name: "AuréLéa",
  isPrivateLabel: true,
  dna: "Quiet luxury in movement",
  targetAudience: "Women 25-40",
  productCategory: "Pilates",
  tone: "Elegant but approachable",
  createdAt: ts,
  updatedAt: ts,
};

describe("buildListingCopyPrompt", () => {
  it("includes product name and brand name", () => {
    const prompt = buildListingCopyPrompt({ product: mockProduct, brand: mockBrand });
    expect(prompt).toContain("Pilates Mini Ball");
    expect(prompt).toContain("AuréLéa");
  });

  it("includes brand DNA", () => {
    const prompt = buildListingCopyPrompt({ product: mockProduct, brand: mockBrand });
    expect(prompt).toContain("Quiet luxury in movement");
  });

  it("includes keywords when provided", () => {
    const prompt = buildListingCopyPrompt({
      product: mockProduct,
      brand: mockBrand,
      keywords: "pilates ball, core training",
    });
    expect(prompt).toContain("pilates ball, core training");
  });

  it("requests JSON output format", () => {
    const prompt = buildListingCopyPrompt({ product: mockProduct, brand: mockBrand });
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"bulletPoints"');
    expect(prompt).toContain('"description"');
  });
});

describe("parseListingCopyResponse", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({
      title: "Test Title",
      bulletPoints: ["A", "B", "C"],
      description: "Test description",
    });
    const result = parseListingCopyResponse(raw);
    expect(result.title).toBe("Test Title");
    expect(result.bulletPoints).toHaveLength(3);
    expect(result.description).toBe("Test description");
  });

  it("extracts JSON from surrounding text", () => {
    const raw = `Here is the listing:\n${JSON.stringify({
      title: "T",
      bulletPoints: ["X"],
      description: "D",
    })}\nDone!`;
    const result = parseListingCopyResponse(raw);
    expect(result.title).toBe("T");
  });

  it("throws on missing JSON", () => {
    expect(() => parseListingCopyResponse("No JSON here")).toThrow(
      "No JSON found",
    );
  });

  it("throws on incomplete JSON", () => {
    expect(() =>
      parseListingCopyResponse(JSON.stringify({ title: "T" })),
    ).toThrow("missing required fields");
  });
});
