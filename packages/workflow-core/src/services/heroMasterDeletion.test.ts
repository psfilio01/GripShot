import { beforeEach, describe, expect, it, vi } from "vitest";

const getVariantById = vi.fn();
const listJobs = vi.fn();
const listVariantsForJob = vi.fn();
const deleteVariantsByIds = vi.fn();
const deleteStoredImage = vi.fn();

vi.mock("./metadataStore", () => ({
  metadataStore: {
    getVariantById: (...args: unknown[]) => getVariantById(...args),
    listJobs: (...args: unknown[]) => listJobs(...args),
    listVariantsForJob: (...args: unknown[]) => listVariantsForJob(...args),
    deleteVariantsByIds: (...args: unknown[]) => deleteVariantsByIds(...args),
  },
}));

vi.mock("./resultStorage", () => ({
  deleteStoredImage: (...args: unknown[]) => deleteStoredImage(...args),
}));

import { deleteHeroMaster } from "./heroMasterDeletion";

describe("deleteHeroMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVariantById.mockResolvedValue({ id: "hero", status: "hero_lock" });
    listJobs.mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]);
    listVariantsForJob
      .mockResolvedValueOnce([
        { id: "hero", filePath: "/hero.png" },
        {
          id: "blue",
          filePath: "/blue.png",
          colorLineage: { parentVariantId: "hero" },
        },
      ])
      .mockResolvedValueOnce([{ id: "other", filePath: "/other.png" }]);
    deleteStoredImage.mockResolvedValue(undefined);
    deleteVariantsByIds.mockResolvedValue(undefined);
  });

  it("deletes a Hero master and its derived variants only", async () => {
    const result = await deleteHeroMaster("hero");

    expect(result?.deletedImageIds).toEqual(["hero", "blue"]);
    expect(deleteStoredImage).toHaveBeenCalledTimes(2);
    expect(deleteStoredImage).not.toHaveBeenCalledWith("/other.png");
    expect(deleteVariantsByIds).toHaveBeenCalledWith(["hero", "blue"]);
  });

  it("does not delete a non-Hero image", async () => {
    getVariantById.mockResolvedValue({ id: "neutral", status: "neutral" });

    await expect(deleteHeroMaster("neutral")).resolves.toBeNull();
    expect(deleteStoredImage).not.toHaveBeenCalled();
  });

  it("deletes a Main master and its derived variants", async () => {
    getVariantById.mockResolvedValue({ id: "hero", status: "main_image" });

    const result = await deleteHeroMaster("hero");

    expect(result?.deletedImageIds).toEqual(["hero", "blue"]);
    expect(deleteVariantsByIds).toHaveBeenCalledWith(["hero", "blue"]);
  });
});
