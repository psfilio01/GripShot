import { describe, it, expect } from "vitest";
import { isValidSceneLock, type SceneLock } from "./sceneLock";

function makeValidSceneLock(overrides: Partial<SceneLock> = {}): SceneLock {
  return {
    sourceAssetId: "img-001",
    productId: "pilates-mini-ball",
    outputType: "AMAZON_LIFESTYLE_SHOT",
    sceneDescription: "Bright studio with natural light",
    subjectDescription: "Woman in seated pilates position",
    productPlacement: "Ball held in both hands at chest height",
    compositionNotes: "Centered, rule of thirds, ample negative space",
    cameraFraming: "Medium shot from slight elevation",
    lightingNotes: "Soft key light from left, warm fill",
    backgroundNotes: "Clean white with subtle shadow gradient",
    protectedInvariants: ["pose", "camera angle", "lighting", "background"],
    editableTargetFields: ["productColor"],
    detectedProductColor: "sage green",
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isValidSceneLock", () => {
  it("returns true for a valid SceneLock", () => {
    expect(isValidSceneLock(makeValidSceneLock())).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(isValidSceneLock(null)).toBe(false);
    expect(isValidSceneLock(undefined)).toBe(false);
  });

  it("returns false when required string fields are missing", () => {
    const fields = [
      "sourceAssetId",
      "productId",
      "outputType",
      "sceneDescription",
      "subjectDescription",
      "productPlacement",
      "compositionNotes",
      "cameraFraming",
      "lightingNotes",
      "backgroundNotes",
    ];
    for (const field of fields) {
      const lock = makeValidSceneLock({ [field]: "" });
      expect(isValidSceneLock(lock)).toBe(false);
    }
  });

  it("returns false when protectedInvariants is not an array", () => {
    const lock = makeValidSceneLock();
    (lock as any).protectedInvariants = "not-an-array";
    expect(isValidSceneLock(lock)).toBe(false);
  });

  it("allows detectedProductColor to be null", () => {
    expect(isValidSceneLock(makeValidSceneLock({ detectedProductColor: null }))).toBe(true);
  });

  it("rejects detectedProductColor as number", () => {
    const lock = makeValidSceneLock();
    (lock as any).detectedProductColor = 42;
    expect(isValidSceneLock(lock)).toBe(false);
  });
});
