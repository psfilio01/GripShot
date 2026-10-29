import { beforeEach, describe, expect, it, vi } from "vitest";

const executeHeroLock = vi.fn();
const consumeCredit = vi.fn();
const deletePending = vi.fn();
const failPending = vi.fn();
const isCancelled = vi.fn();

vi.mock("@fashionmentum/workflow-core", () => ({
  executeHeroLock: (...args: unknown[]) => executeHeroLock(...args),
}));

vi.mock("@/lib/billing/quota", () => ({
  consumeCredit: (...args: unknown[]) => consumeCredit(...args),
}));

vi.mock("@/lib/db/pending-image-generations", () => ({
  deletePendingImageGeneration: (...args: unknown[]) => deletePending(...args),
  failPendingImageGeneration: (...args: unknown[]) => failPending(...args),
  isPendingImageGenerationCancelled: (...args: unknown[]) => isCancelled(...args),
}));

import { runPendingHeroLock } from "./run-pending";

const input = {
  workspaceId: "workspace-1",
  isAdmin: false,
  requestId: "request-1",
  master: {
    id: "master-1",
    jobId: "job-1",
    productId: "product-1",
    status: "hero_lock" as const,
    filePath: "/data/master.png",
    createdAt: new Date().toISOString(),
  },
  targetColors: [{ id: "blue", name: "Blue", hex: "#0000FF" }],
};

describe("runPendingHeroLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletePending.mockResolvedValue(undefined);
    failPending.mockResolvedValue(undefined);
    consumeCredit.mockResolvedValue(undefined);
    isCancelled.mockResolvedValue(false);
  });

  it("charges only successful variants and removes the placeholder", async () => {
    executeHeroLock.mockResolvedValue({
      generatedVariants: [
        { status: "completed" },
        { status: "failed" },
      ],
    });

    await runPendingHeroLock(input);

    expect(consumeCredit).toHaveBeenCalledWith("workspace-1", 1);
    expect(deletePending).toHaveBeenCalledWith("workspace-1", "request-1");
    expect(failPending).not.toHaveBeenCalled();
  });

  it("does not charge admins", async () => {
    executeHeroLock.mockResolvedValue({
      generatedVariants: [{ status: "completed" }],
    });

    await runPendingHeroLock({ ...input, isAdmin: true });

    expect(consumeCredit).not.toHaveBeenCalled();
    expect(deletePending).toHaveBeenCalled();
  });

  it("passes the captured product color rules and notes to the core", async () => {
    executeHeroLock.mockResolvedValue({ generatedVariants: [{ status: "completed" }] });
    const recolorPolicy = { allComponentsFollowTargetColor: true, instructions: "Valve follows target color." };
    const targetColors = [{ id: "white", name: "White", hex: "#FFFFFF", notes: "No black insert." }];
    await runPendingHeroLock({ ...input, targetColors, recolorPolicy });
    expect(executeHeroLock).toHaveBeenCalledWith(input.master, targetColors, expect.objectContaining({ recolorPolicy }));
  });

  it("passes the previous variant id only for a single-color retry", async () => {
    executeHeroLock.mockResolvedValue({ generatedVariants: [{ status: "completed" }] });
    await runPendingHeroLock({ ...input, regeneratedFromVariantId: "old-blue" });
    expect(executeHeroLock).toHaveBeenCalledWith(
      input.master,
      input.targetColors,
      expect.objectContaining({ regeneratedFromVariantId: "old-blue" }),
    );
  });

  it("marks the placeholder failed when no variant succeeds", async () => {
    executeHeroLock.mockResolvedValue({
      generatedVariants: [{ status: "failed" }],
    });

    await runPendingHeroLock(input);

    expect(deletePending).not.toHaveBeenCalled();
    expect(failPending).toHaveBeenCalledWith(
      "workspace-1",
      "request-1",
      "No color variant could be generated.",
    );
  });

  it("does not start work when the run was cancelled", async () => {
    isCancelled.mockResolvedValue(true);

    await runPendingHeroLock(input);

    expect(executeHeroLock).not.toHaveBeenCalled();
    expect(consumeCredit).not.toHaveBeenCalled();
    expect(failPending).not.toHaveBeenCalled();
  });

  it("keeps a cancelled placeholder hidden without marking it failed", async () => {
    executeHeroLock.mockResolvedValue({
      cancelled: true,
      generatedVariants: [{ status: "completed" }],
    });

    await runPendingHeroLock(input);

    expect(consumeCredit).toHaveBeenCalledWith("workspace-1", 1);
    expect(deletePending).not.toHaveBeenCalled();
    expect(failPending).not.toHaveBeenCalled();
  });
});
