import { beforeEach, describe, expect, it, vi } from "vitest";

const generateImagesWithNanoBanana = vi.fn();

vi.mock("./imageGenerator", () => ({
  generateImagesWithNanoBanana: (...args: unknown[]) =>
    generateImagesWithNanoBanana(...args),
}));

import { generateMainImageVariant } from "./mainImageGenerator";
import type { SceneLock } from "../domain/sceneLock";

const sceneLock: SceneLock = {
  sourceAssetId: "source-1",
  productId: "product-1",
  outputType: "MAIN_IMAGE",
  sceneDescription: "A black exercise ball in a studio",
  subjectDescription: "Black exercise ball",
  productPlacement: "Centered",
  compositionNotes: "Front view",
  cameraFraming: "Product fills frame",
  lightingNotes: "Soft studio light",
  backgroundNotes: "Light gray background",
  protectedInvariants: ["embossed logo", "seams", "valve"],
  editableTargetFields: ["background", "productColor"],
  detectedProductColor: "Black",
  extractedAt: new Date().toISOString(),
};

describe("generateMainImageVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("instructs Gemini to preserve the product and contact shadow without a quality-check round trip", async () => {
    const outputBuffer = Buffer.from("generated-image");
    generateImagesWithNanoBanana.mockResolvedValue([
      { buffer: outputBuffer, extension: "webp" },
    ]);

    const result = await generateMainImageVariant({
      sourceImagePath: "/data/source.png",
      sceneLock,
      targetColorName: "Soft Rose",
      targetColorHex: "#E7B7C8",
    });

    expect(generateImagesWithNanoBanana).toHaveBeenCalledTimes(1);
    const prompt = generateImagesWithNanoBanana.mock.calls[0][0].text as string;
    expect(prompt).toContain("#FFFFFF");
    expect(prompt).toContain("soft natural contact shadow");
    expect(prompt).toContain("embossed logo");
    expect(prompt).toContain("Soft Rose (#E7B7C8)");
    expect(result).toEqual({ buffer: outputBuffer, extension: "webp" });
  });
});
