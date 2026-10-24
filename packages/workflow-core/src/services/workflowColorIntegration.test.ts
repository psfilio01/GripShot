import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./metadataStore", () => ({
  metadataStore: {
    getJob: vi.fn().mockResolvedValue({
      id: "wf-job-1",
      productId: "grip-socks",
      workflowType: "NEUTRAL_PRODUCT_SHOT",
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
    sourceAssetId: "wf-master",
    productId: "grip-socks",
    outputType: "NEUTRAL_PRODUCT_SHOT",
    sceneDescription: "Clean studio",
    subjectDescription: "Product on neutral background",
    productPlacement: "Center",
    compositionNotes: "Centered",
    cameraFraming: "Full frame",
    lightingNotes: "Soft diffused light",
    backgroundNotes: "White backdrop",
    protectedInvariants: ["composition", "lighting"],
    editableTargetFields: ["productColor"],
    detectedProductColor: "black",
    extractedAt: new Date().toISOString(),
  }),
}));

vi.mock("./recolorGenerator", () => ({
  generateRecolorVariant: vi.fn().mockResolvedValue({
    buffer: Buffer.from("fake-recolored-image"),
    extension: "png",
  }),
}));

vi.mock("./resultStorage", () => ({
  storeImage: vi.fn().mockResolvedValue("/data/generated/grip-socks/wf-job/neutral/v-color.png"),
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
    NANOBANANA_PLANNER_MODEL: "gemini-2.5-flash",
  }),
}));

import { executeHeroLock } from "./heroLockOrchestrator";
import type { ImageVariant } from "../domain/imageVariant";

describe("Workflow color variant integration", () => {
  const syntheticVariant: ImageVariant = {
    id: "wf-master",
    jobId: "workflow-abc-step-0",
    productId: "grip-socks",
    status: "hero_lock",
    filePath: "/data/generated/grip-socks/wf-job/neutral/step-0.png",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates variants with filePaths for workflow steps", async () => {
    const result = await executeHeroLock(syntheticVariant, [
      { id: "c1", name: "Sage Green", hex: "#8F9D6A" },
      { id: "c2", name: "Navy Blue", hex: "#1B2A4A" },
      { id: "c3", name: "Dusty Rose", hex: "#D4A5A5" },
    ]);

    const completed = result.generatedVariants.filter(
      (v) => v.status === "completed",
    );
    expect(completed.length).toBeGreaterThanOrEqual(1);

    for (const v of completed) {
      expect(v.filePath).toBeDefined();
      expect(v.filePath).toBe("/data/generated/grip-socks/wf-job/neutral/v-color.png");
    }
  });

  it("returns filePath on each completed variant", async () => {
    const result = await executeHeroLock(syntheticVariant, [
      { id: "c1", name: "Navy Blue", hex: "#1B2A4A" },
    ]);

    expect(result.generatedVariants).toHaveLength(1);
    expect(result.generatedVariants[0].filePath).toBe("/data/generated/grip-socks/wf-job/neutral/v-color.png");
    expect(result.generatedVariants[0].status).toBe("completed");
  });

  it("maps HeroLockResult to WorkflowStepColorVariant shape", async () => {
    const result = await executeHeroLock(syntheticVariant, [
      { id: "c1", name: "Navy Blue", hex: "#1B2A4A" },
      { id: "c2", name: "Dusty Rose", hex: "#D4A5A5" },
    ]);

    const colorVariants = result.generatedVariants.map((v) => ({
      colorId: "c1",
      colorName: v.colorName,
      colorHex: v.colorHex,
      imagePath: v.filePath ?? "",
      status: v.status === "completed" ? "completed" : "failed",
    }));

    expect(colorVariants).toHaveLength(2);
    for (const cv of colorVariants) {
      expect(cv.imagePath).not.toBe("");
      expect(cv.status).toBe("completed");
      expect(cv.colorName).toBeTruthy();
      expect(cv.colorHex).toBeTruthy();
    }
  });

  it("skips black (detected original) and generates remaining", async () => {
    const result = await executeHeroLock(syntheticVariant, [
      { id: "c0", name: "Black", hex: "#000000" },
      { id: "c1", name: "Navy Blue", hex: "#1B2A4A" },
    ]);

    expect(result.skippedColors).toContain("Black");
    expect(result.generatedVariants).toHaveLength(1);
    expect(result.generatedVariants[0].colorName).toBe("Navy Blue");
    expect(result.generatedVariants[0].filePath).toBe("/data/generated/grip-socks/wf-job/neutral/v-color.png");
  });

  it("handles all colors being the detected original", async () => {
    const result = await executeHeroLock(syntheticVariant, [
      { id: "c0", name: "black", hex: "#000000" },
    ]);

    expect(result.skippedColors).toContain("black");
    expect(result.generatedVariants).toHaveLength(0);
  });
});
