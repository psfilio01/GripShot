import { beforeEach, describe, expect, it, vi } from "vitest";

const insertJob = vi.fn();
const insertVariant = vi.fn();
const updateJobStatus = vi.fn();
const storeImage = vi.fn();

vi.mock("nanoid", () => ({
  nanoid: (() => {
    let call = 0;
    return vi.fn(() =>
      call++ % 2 === 0 ? "external-job" : "external-master",
    );
  })(),
}));

vi.mock("../config/env", () => ({
  getEnv: () => ({ WORKFLOW_DATA_ROOT: "/data" }),
}));

vi.mock("../domain/product", () => ({
  buildProductFromId: (id: string) => ({
    id,
    name: id,
    basePath: `/data/products/${id}`,
  }),
}));

vi.mock("./metadataStore", () => ({
  metadataStore: {
    insertJob: (...args: unknown[]) => insertJob(...args),
    insertVariant: (...args: unknown[]) => insertVariant(...args),
    updateJobStatus: (...args: unknown[]) => updateJobStatus(...args),
  },
}));

vi.mock("./resultStorage", () => ({
  storeImage: (...args: unknown[]) => storeImage(...args),
}));

import { registerExternalHeroMaster } from "./externalHeroMaster";

describe("registerExternalHeroMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeImage.mockResolvedValue(
      "/data/generated/product-1/external-job/favorites/external-master.png",
    );
  });

  it("stores an upload as a completed Hero master", async () => {
    const master = await registerExternalHeroMaster({
      productId: "product-1",
      buffer: Buffer.from("image"),
      extension: "png",
    });

    expect(insertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "external-job",
        productId: "product-1",
        workflowType: "EXTERNAL_HERO_UPLOAD",
        status: "running",
      }),
    );
    expect(storeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "external-job",
        imageId: "external-master",
        bucket: "favorites",
        extension: "png",
      }),
    );
    expect(master).toEqual(
      expect.objectContaining({
        id: "external-master",
        status: "hero_lock",
        heroLockId: "external-master",
      }),
    );
    expect(insertVariant).toHaveBeenCalledWith(master);
    expect(updateJobStatus).toHaveBeenCalledWith("external-job", "completed");
  });

  it("stores a Main upload as a hidden temporary source", async () => {
    const source = await registerExternalHeroMaster({
      productId: "product-1",
      buffer: Buffer.from("image"),
      extension: "png",
      mode: "main",
    });

    expect(source).toEqual(
      expect.objectContaining({
        status: "main_source",
        temporarySource: true,
      }),
    );
    expect(source.heroLockId).toBeUndefined();
  });

  it("marks the import job failed when storage fails", async () => {
    storeImage.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      registerExternalHeroMaster({
        productId: "product-1",
        buffer: Buffer.from("image"),
        extension: "png",
      }),
    ).rejects.toThrow("storage unavailable");

    expect(updateJobStatus).toHaveBeenCalledWith("external-job", "failed");
    expect(insertVariant).not.toHaveBeenCalled();
  });
});
