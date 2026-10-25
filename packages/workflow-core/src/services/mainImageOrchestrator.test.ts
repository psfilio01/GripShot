import { beforeEach, describe, expect, it, vi } from "vitest";

const insertJob = vi.fn();
const updateJobStatus = vi.fn();
const insertVariant = vi.fn();
const generateMainImageVariant = vi.fn();
const storeImage = vi.fn();

vi.mock("./metadataStore", () => ({
  metadataStore: {
    getJob: vi.fn().mockResolvedValue({ workflowType: "NEUTRAL_PRODUCT_SHOT" }),
    insertJob: (...args: unknown[]) => insertJob(...args),
    updateJobStatus: (...args: unknown[]) => updateJobStatus(...args),
    insertVariant: (...args: unknown[]) => insertVariant(...args),
  },
}));

vi.mock("./sceneExtractor", () => ({
  extractSceneLock: vi.fn().mockResolvedValue({
    sourceAssetId: "source-1",
    productId: "product-1",
    outputType: "NEUTRAL_PRODUCT_SHOT",
    protectedInvariants: ["logo", "shadow"],
    editableTargetFields: ["background", "productColor"],
    detectedProductColor: "Black",
  }),
}));

vi.mock("./mainImageGenerator", () => ({
  generateMainImageVariant: (...args: unknown[]) =>
    generateMainImageVariant(...args),
}));

vi.mock("./resultStorage", () => ({
  storeImage: (...args: unknown[]) => storeImage(...args),
  deleteStoredImage: vi.fn(),
}));

vi.mock("../domain/product", () => ({
  buildProductFromId: (id: string) => ({ id, name: id, basePath: "/data" }),
}));

vi.mock("../config/env", () => ({
  getEnv: () => ({ WORKFLOW_DATA_ROOT: "/data" }),
}));

import { executeMainImageLock } from "./mainImageOrchestrator";
import type { ImageVariant } from "../domain/imageVariant";

const source: ImageVariant = {
  id: "source-1",
  jobId: "job-1",
  productId: "product-1",
  status: "neutral",
  filePath: "/data/source.png",
  createdAt: new Date().toISOString(),
};

describe("executeMainImageLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateMainImageVariant.mockResolvedValue({
      buffer: Buffer.from("image"),
      extension: "png",
    });
    storeImage
      .mockResolvedValueOnce("/data/main.png")
      .mockResolvedValueOnce("/data/rose.png");
  });

  it("creates a Main master, skips the detected original color, and derives remaining colors from Main", async () => {
    const result = await executeMainImageLock(source, [
      { id: "black", name: "Black", hex: "#111111" },
      { id: "rose", name: "Soft Rose", hex: "#E7B7C8" },
    ]);

    expect(result.skippedColors).toEqual(["Black"]);
    expect(result.generatedVariants).toHaveLength(2);
    expect(generateMainImageVariant).toHaveBeenCalledTimes(2);
    expect(generateMainImageVariant.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        sourceImagePath: "/data/main.png",
        targetColorName: "Soft Rose",
      }),
    );
    expect(insertVariant).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "main_image" }),
    );
    expect(insertVariant).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "neutral",
        colorLineage: expect.objectContaining({
          generationMethod: "main_image_recolor",
        }),
      }),
    );
    expect(updateJobStatus).toHaveBeenLastCalledWith(
      result.variantJobId,
      "completed",
    );
  });
});
