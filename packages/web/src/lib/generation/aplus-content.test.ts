import { describe, it, expect } from "vitest";
import {
  APLUS_MODULES,
  getModuleById,
  buildAplusPrompt,
  parseAplusResponse,
} from "./aplus-content";

describe("APLUS_MODULES", () => {
  it("defines five module types", () => {
    expect(APLUS_MODULES).toHaveLength(5);
  });

  it("each module has required fields", () => {
    for (const mod of APLUS_MODULES) {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.amazonModuleType).toBeTruthy();
      expect(mod.fields.length).toBeGreaterThan(0);
    }
  });

  it("has unique IDs", () => {
    const ids = APLUS_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getModuleById", () => {
  it("returns the correct module", () => {
    const mod = getModuleById("hero-banner");
    expect(mod).toBeDefined();
    expect(mod!.name).toBe("Hero Banner");
  });

  it("returns undefined for unknown id", () => {
    expect(getModuleById("nonexistent")).toBeUndefined();
  });
});

describe("buildAplusPrompt", () => {
  const baseInput = {
    moduleId: "hero-banner",
    productName: "Pilates Mini Ball",
    productDescription: "A premium 9-inch exercise ball",
    brandName: "AuréLéa",
    brandDna: "Quiet luxury in movement",
  };

  it("includes product and brand info", () => {
    const prompt = buildAplusPrompt(baseInput);
    expect(prompt).toContain("Pilates Mini Ball");
    expect(prompt).toContain("AuréLéa");
    expect(prompt).toContain("Hero Banner");
  });

  it("includes additional notes when provided", () => {
    const prompt = buildAplusPrompt({
      ...baseInput,
      additionalNotes: "Focus on eco materials",
    });
    expect(prompt).toContain("Focus on eco materials");
  });

  it("throws for unknown module", () => {
    expect(() =>
      buildAplusPrompt({ ...baseInput, moduleId: "fake" }),
    ).toThrow("Unknown A+ module");
  });

  it("includes JSON format instructions for each module", () => {
    for (const mod of APLUS_MODULES) {
      const prompt = buildAplusPrompt({ ...baseInput, moduleId: mod.id });
      expect(prompt).toContain("JSON");
    }
  });
});

describe("parseAplusResponse", () => {
  it("parses valid JSON", () => {
    const result = parseAplusResponse('{"headline": "test"}');
    expect(result).toEqual({ headline: "test" });
  });

  it("strips markdown code fences", () => {
    const result = parseAplusResponse(
      '```json\n{"headline": "test"}\n```',
    );
    expect(result).toEqual({ headline: "test" });
  });

  it("strips bare code fences", () => {
    const result = parseAplusResponse('```\n{"headline": "test"}\n```');
    expect(result).toEqual({ headline: "test" });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAplusResponse("not json")).toThrow(
      "Failed to parse A+ content response",
    );
  });
});
