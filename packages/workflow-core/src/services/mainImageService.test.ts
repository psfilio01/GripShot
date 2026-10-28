import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getVariantById: vi.fn(), insertJob: vi.fn(), insertVariant: vi.fn(), updateJobStatus: vi.fn(), deleteVariantsByIds: vi.fn(), read: vi.fn(), store: vi.fn(), remove: vi.fn(), worker: vi.fn() }));
vi.mock("./metadataStore", () => ({ metadataStore: mocks }));
vi.mock("./imageFileRead", () => ({ readImageFileForProcessing: mocks.read }));
vi.mock("./resultStorage", () => ({ storeImage: mocks.store, deleteStoredImage: mocks.remove }));
vi.mock("./mainImageWorker", () => ({ runMainImageWorker: mocks.worker }));
vi.mock("../config/env", () => ({ getEnv: () => ({ WORKFLOW_DATA_ROOT: "/data" }) }));
import { createMainImage, deleteMainImage } from "./mainImageService";
const source = { id: "hero-1", jobId: "source-job", productId: "product-1", status: "hero_lock", filePath: "/data/hero.png", colorVariant: "Rose", createdAt: "2026-10-28T00:00:00Z" };
describe("Main image service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getVariantById.mockResolvedValue(source);
    mocks.read.mockResolvedValue({ buffer: Buffer.from("original"), ext: "png" });
    mocks.worker.mockResolvedValue({ buffer: Buffer.from("main-png"), sourceSha256: "hash", metrics: { requiresReview: true } });
    mocks.store.mockResolvedValue("/data/main.png");
    mocks.remove.mockResolvedValue(undefined);
  });
  it("creates an independent unreviewed PNG without modifying the source or recoloring", async () => {
    const result = await createMainImage("hero-1", true);
    expect(result.mainImage).toMatchObject({ sourceVariantId: "hero-1", sourceSha256: "hash", preserveShadow: true, reviewed: false });
    expect(result.colorLineage).toBeUndefined();
    expect(result.heroLockId).toBeUndefined();
    expect(result.colorVariant).toBe("Rose");
    expect(mocks.store).toHaveBeenCalledWith(expect.objectContaining({ extension: "png", bucket: "neutral" }));
    expect(mocks.updateJobStatus).toHaveBeenLastCalledWith(result.jobId, "completed");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("cancels before publishing if the original was deleted during processing", async () => {
    mocks.getVariantById.mockResolvedValueOnce(source).mockResolvedValue(null);
    await expect(createMainImage("hero-1")).rejects.toThrow("cancelled");
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.insertVariant).not.toHaveBeenCalled();
    expect(mocks.updateJobStatus).toHaveBeenLastCalledWith(expect.any(String), "cancelled");
  });
  it("cleans up a newly stored file if cancellation arrives during persistence", async () => {
    const controller = new AbortController();
    mocks.store.mockImplementation(async () => { controller.abort(); return "/data/main.png"; });
    await expect(createMainImage("hero-1", false, { signal: controller.signal })).rejects.toThrow("cancelled");
    expect(mocks.remove).toHaveBeenCalledWith("/data/main.png");
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });
  it("refuses derived-on-derived processing", async () => {
    mocks.getVariantById.mockResolvedValue({ ...source, mainImage: { reviewed: false } });
    await expect(createMainImage("hero-1")).rejects.toThrow("not another Main");
    expect(mocks.worker).not.toHaveBeenCalled();
  });
  it("never deletes originals and deletes only the requested Main copy", async () => {
    expect(await deleteMainImage("hero-1")).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
    mocks.getVariantById.mockResolvedValue({ ...source, id: "main-1", filePath: "/data/main.png", mainImage: { sourceVariantId: "hero-1" } });
    expect(await deleteMainImage("main-1")).toBe(true);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith("/data/main.png");
    expect(mocks.deleteVariantsByIds).toHaveBeenCalledWith(["main-1"]);
  });
});
