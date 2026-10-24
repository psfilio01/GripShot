import { describe, it, expect } from "vitest";
import {
  extractImagesFromContentParts,
  joinTextPartsFromGeminiContent,
} from "./imageGenerator";

describe("extractImagesFromContentParts", () => {
  it("reads camelCase inlineData from Gemini REST", () => {
    const b64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    const images = extractImagesFromContentParts([
      { inlineData: { mimeType: "image/png", data: b64 } },
    ]);
    expect(images).toHaveLength(1);
    expect(images[0]!.extension).toBe("png");
    expect(images[0]!.buffer.equals(Buffer.from(b64, "base64"))).toBe(true);
  });

  it("reads snake_case inline_data from Gemini REST", () => {
    const b64 = Buffer.from("x").toString("base64");
    const images = extractImagesFromContentParts([
      { inline_data: { mime_type: "image/jpeg", data: b64 } },
    ]);
    expect(images).toHaveLength(1);
    expect(images[0]!.extension).toBe("jpeg");
  });
});

describe("joinTextPartsFromGeminiContent", () => {
  it("joins text parts", () => {
    expect(
      joinTextPartsFromGeminiContent([{ text: "a" }, { text: "b" }]),
    ).toBe("a b");
  });
});
