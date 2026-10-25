import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMainImageLock = vi.fn();
const deleteTemporaryImageSource = vi.fn();
const consumeCredit = vi.fn();
const deletePending = vi.fn();
const failPending = vi.fn();
const isCancelled = vi.fn();

vi.mock("@fashionmentum/workflow-core", () => ({
  executeMainImageLock: (...args: unknown[]) => executeMainImageLock(...args),
  deleteTemporaryImageSource: (...args: unknown[]) =>
    deleteTemporaryImageSource(...args),
}));

vi.mock("@/lib/billing/quota", () => ({
  consumeCredit: (...args: unknown[]) => consumeCredit(...args),
}));

vi.mock("@/lib/db/pending-image-generations", () => ({
  deletePendingImageGeneration: (...args: unknown[]) => deletePending(...args),
  failPendingImageGeneration: (...args: unknown[]) => failPending(...args),
  isPendingImageGenerationCancelled: (...args: unknown[]) => isCancelled(...args),
}));

import { runPendingMainImage } from "./run-pending";

const input = {
  workspaceId: "workspace-1",
  isAdmin: false,
  requestId: "request-1",
  source: {
    id: "source-1",
    jobId: "job-1",
    productId: "product-1",
    status: "main_source" as const,
    filePath: "/data/source.png",
    temporarySource: true,
    createdAt: new Date().toISOString(),
  },
  targetColors: [{ id: "rose", name: "Rose", hex: "#E7B7C8" }],
};

describe("runPendingMainImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCancelled.mockResolvedValue(false);
    consumeCredit.mockResolvedValue(undefined);
    deletePending.mockResolvedValue(undefined);
    failPending.mockResolvedValue(undefined);
    deleteTemporaryImageSource.mockResolvedValue(undefined);
  });

  it("charges every successful Main output and removes the placeholder", async () => {
    executeMainImageLock.mockResolvedValue({
      generatedVariants: [{ status: "completed" }, { status: "completed" }],
    });

    await runPendingMainImage(input);

    expect(consumeCredit).toHaveBeenCalledWith("workspace-1", 2);
    expect(deletePending).toHaveBeenCalledWith("workspace-1", "request-1");
    expect(failPending).not.toHaveBeenCalled();
  });

  it("cleans up an external temporary source even if generation fails", async () => {
    executeMainImageLock.mockRejectedValue(new Error("Gemini unavailable"));

    await runPendingMainImage(input);

    expect(failPending).toHaveBeenCalledWith(
      "workspace-1",
      "request-1",
      "Gemini unavailable",
    );
    expect(deleteTemporaryImageSource).toHaveBeenCalledWith("source-1");
  });
});
