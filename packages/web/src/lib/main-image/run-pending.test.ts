import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), getVariant: vi.fn(), cancelled: vi.fn(), product: vi.fn(), removePending: vi.fn(), failPending: vi.fn(), credit: vi.fn() }));
vi.mock("@fashionmentum/workflow-core", () => ({ createMainImage: mocks.create, metadataStore: { getVariantById: mocks.getVariant }, isGenerationCancelledError: (error: Error) => error.name === "AbortError" }));
vi.mock("@/lib/db/products", () => ({ getProduct: mocks.product }));
vi.mock("@/lib/db/pending-image-generations", () => ({ isPendingImageGenerationCancelled: mocks.cancelled, deletePendingImageGeneration: mocks.removePending, failPendingImageGeneration: mocks.failPending }));
vi.mock("@/lib/billing/quota", () => ({ consumeCredit: mocks.credit }));
import { runPendingMainImage } from "./run-pending";
const input = { workspaceId: "workspace-1", requestId: "request-1", sourceImageId: "source-1", productId: "product-1", preserveShadow: true };
describe("pending Main images", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cancelled.mockResolvedValue(false);
    mocks.product.mockResolvedValue({ id: "product-1", deletedAt: null });
    mocks.getVariant.mockResolvedValue({ id: "source-1", productId: "product-1" });
    mocks.removePending.mockResolvedValue(undefined);
    mocks.failPending.mockResolvedValue(undefined);
  });
  it("finishes without charging credits", async () => {
    await runPendingMainImage(input);
    expect(mocks.create).toHaveBeenCalledWith("source-1", true, expect.objectContaining({ signal: expect.any(AbortSignal), isCancelled: expect.any(Function) }));
    expect(mocks.removePending).toHaveBeenCalledWith("workspace-1", "request-1");
    expect(mocks.credit).not.toHaveBeenCalled();
  });
  it("does not run cancelled or deleted-product jobs", async () => {
    mocks.cancelled.mockResolvedValue(true);
    await runPendingMainImage(input);
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.cancelled.mockResolvedValue(false);
    mocks.product.mockResolvedValue({ deletedAt: "deleted" });
    await runPendingMainImage(input);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("surfaces worker errors with no automatic retry or token charge", async () => {
    mocks.create.mockRejectedValue(new Error("Unsupported background"));
    await runPendingMainImage(input);
    expect(mocks.failPending).toHaveBeenCalledWith("workspace-1", "request-1", "Unsupported background");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.credit).not.toHaveBeenCalled();
  });
});
