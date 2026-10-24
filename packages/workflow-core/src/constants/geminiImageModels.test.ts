import { describe, expect, it } from "vitest";
import {
  ALLOWED_GEMINI_IMAGE_MODEL_IDS,
  isAllowedGeminiImageModel,
  normalizeGeminiImageModel,
} from "./geminiImageModels";

describe("Gemini image model IDs", () => {
  it("exposes the current production image models", () => {
    expect(ALLOWED_GEMINI_IMAGE_MODEL_IDS).toEqual([
      "gemini-nano-banana-2.1",
      "gemini-3-pro-image",
    ]);
  });

  it.each([
    ["gemini-3.1-flash-image-preview", "gemini-nano-banana-2.1"],
    ["gemini-3-pro-image-preview", "gemini-3-pro-image"],
  ])("maps legacy model %s to %s", (legacy, replacement) => {
    expect(isAllowedGeminiImageModel(legacy)).toBe(true);
    expect(normalizeGeminiImageModel(legacy)).toBe(replacement);
  });

  it("rejects unknown and empty model IDs", () => {
    expect(isAllowedGeminiImageModel("gemini-text-only")).toBe(false);
    expect(normalizeGeminiImageModel(" ")).toBeUndefined();
  });
});
