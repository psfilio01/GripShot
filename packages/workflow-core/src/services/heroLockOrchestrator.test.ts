import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./metadataStore", () => ({
  metadataStore: {
    getJob: vi.fn().mockResolvedValue({
      id: "job-1",
      productId: "grip-socks",
      workflowType: "AMAZON_LIFESTYLE_SHOT",
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    insertJob: vi.fn().mockResolvedValue(undefined),
    updateJobStatus: vi.fn().mockResolvedValue(undefined),
    insertVariant: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./sceneExtractor", () => ({
  extractSceneLock: vi.fn().mockResolvedValue({
    sourceAssetId: "img-master",
    productId: "grip-socks",
    outputType: "AMAZON_LIFESTYLE_SHOT",
    sceneDescription: "Bright studio",
    subjectDescription: "Woman in pilates pose",
    productPlacement: "Worn on feet",
    compositionNotes: "Centered",
    cameraFraming: "Medium shot",
    lightingNotes: "Soft natural light",
    backgroundNotes: "White studio",
    protectedInvariants: ["pose", "lighting"],
    editableTargetFields: ["productColor"],
    detectedProductColor: "sage green",
    extractedAt: new Date().toISOString(),
  }),
}));

vi.mock("./recolorGenerator", () => ({
  generateRecolorVariant: vi.fn().mockResolvedValue({
    buffer: Buffer.from("fake-image"),
    extension: "png",
  }),
}));

vi.mock("./resultStorage", () => ({
  storeImage: vi.fn().mockResolvedValue("/data/generated/grip-socks/job-1/neutral/v1.png"),
}));

vi.mock("../domain/product", () => ({
  buildProductFromId: vi.fn().mockReturnValue({
    id: "grip-socks",
    name: "Grip Socks",
    folder: "/data/products/grip-socks",
  }),
}));

vi.mock("../config/env", () => ({
  getEnv: vi.fn().mockReturnValue({
    WORKFLOW_DATA_ROOT: "/data",
    NANOBANANA_DRY_RUN: false,
    NANOBANANA_API_KEY: "test-key",
    NANOBANANA_BASE_URL: "https://test.example.com",
    NANOBANANA_MODEL: "gemini-2.5-flash-image",
  }),
}));

import { executeHeroLock } from "./heroLockOrchestrator";
import type { ImageVariant } from "../domain/imageVariant";

describe("executeHeroLock", () => {
  const masterVariant: ImageVariant = {
    id: "img-master",
    jobId: "job-1",
    productId: "grip-socks",
    status: "hero_lock",
    filePath: "/data/generated/grip-socks/job-1/favorites/img-master.png",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates variants for each target color", async () => {
    const result = await executeHeroLock(masterVariant, [
      { id: "c1", name: "Navy Blue", hex: "#1B2A4A" },
      { id: "c2", name: "Dusty Rose", hex: "#D4A5A5" },
    ]);

    expect(result.generatedVariants).toHaveLength(2);
    expect(result.generatedVariants[0].colorName).toBe("Navy Blue");
    expect(result.generatedVariants[0].status).toBe("completed");
    expect(result.generatedVariants[1].colorName).toBe("Dusty Rose");
    expect(result.generatedVariants[1].status).toBe("completed");
  });

  it("skips the original detected color", async () => {
    const result = await executeHeroLock(masterVariant, [
      { id: "c1", name: "sage green", hex: "#8F9D6A" },
      { id: "c2", name: "Navy Blue", hex: "#1B2A4A" },
    ]);

    expect(result.skippedColors).toEqual(["sage green"]);
    expect(result.generatedVariants).toHaveLength(1);
    expect(result.generatedVariants[0].colorName).toBe("Navy Blue");
  });

  it("skips original color case-insensitively", async () => {
    const result = await executeHeroLock(masterVariant, [
      { id: "c1", name: "Sage Green", hex: "#8F9D6A" },
    ]);

    expect(result.skippedColors).toEqual(["Sage Green"]);
    expect(result.generatedVariants).toHaveLength(0);
  });

  it("returns sceneLock and heroLockId", async () => {
    const result = await executeHeroLock(masterVariant, [
      { id: "c1", name: "Navy Blue", hex: "#1B2A4A" },
    ]);

    expect(result.heroLockId).toBeTruthy();
    expect(result.sceneLock).toBeTruthy();
    expect(result.sceneLock.detectedProductColor).toBe("sage green");
    expect(result.variantJobId).toBeTruthy();
  });
});
