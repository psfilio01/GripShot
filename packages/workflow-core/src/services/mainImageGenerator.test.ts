import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateImagesWithNanoBanana = vi.fn();

vi.mock("./imageGenerator", () => ({
  generateImagesWithNanoBanana: (...args: unknown[]) =>
    generateImagesWithNanoBanana(...args),
}));

import {
  generateMainImageVariant,
  normalizeConnectedLightBackground,
} from "./mainImageGenerator";
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

async function sampleImage(): Promise<Buffer> {
  const data = Buffer.alloc(5 * 5 * 3, 250);
  // Dark product and contact shadow. Neither is a light edge-connected pixel.
  for (const [pixel, value] of [
    [12, 20],
    [17, 240],
  ] as const) {
    const offset = pixel * 3;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
  }
  return sharp(data, { raw: { width: 5, height: 5, channels: 3 } })
    .png()
    .toBuffer();
}

describe("normalizeConnectedLightBackground", () => {
  it("turns edge-connected neutral background pure white and preserves dark product/shadow pixels", async () => {
    const output = await normalizeConnectedLightBackground(await sampleImage());
    const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });

    expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
    expect([...data.subarray(12 * 3, 12 * 3 + 3)]).toEqual([20, 20, 20]);
    expect([...data.subarray(17 * 3, 17 * 3 + 3)]).toEqual([240, 240, 240]);
  });
});

describe("generateMainImageVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("instructs Gemini to preserve the product and contact shadow without a quality-check round trip", async () => {
    generateImagesWithNanoBanana.mockResolvedValue([
      { buffer: await sampleImage(), extension: "png" },
    ]);

    await generateMainImageVariant({
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
  });
});
