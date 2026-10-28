import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), product: vi.fn(), variant: vi.fn(), review: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/products", () => ({ getProduct: mocks.product }));
vi.mock("@fashionmentum/workflow-core", () => ({ metadataStore: { getVariantById: mocks.variant, setMainImageReviewed: mocks.review }, deleteMainImage: mocks.remove }));
import { DELETE, PATCH } from "./route";
const context = { params: Promise.resolve({ imageId: "main-1" }) };
const request = (body?: unknown) => new NextRequest("http://localhost/api/main-image/main-1", { method: body ? "PATCH" : "DELETE", ...(body ? { body: JSON.stringify(body) } : {}) });
describe("Main review and deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" } });
    mocks.variant.mockResolvedValue({ id: "main-1", productId: "product-1", mainImage: { sourceVariantId: "hero-1", reviewed: false } });
    mocks.product.mockResolvedValue({ id: "product-1", deletedAt: null });
    mocks.review.mockResolvedValue({ mainImage: { reviewed: true } });
    mocks.remove.mockResolvedValue(true);
  });
  it("records only explicit user review", async () => {
    expect((await PATCH(request({ reviewed: true }), context)).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith("main-1", true);
    expect((await PATCH(request({ reviewed: false }), context)).status).toBe(200);
    expect(mocks.review).toHaveBeenLastCalledWith("main-1", false);
    expect((await PATCH(request({ reviewed: true, filePath: "/other" }), context)).status).toBe(400);
  });
  it("denies another workspace and never calls deletion/review", async () => {
    mocks.product.mockResolvedValue(null);
    expect((await DELETE(request(), context)).status).toBe(404);
    expect((await PATCH(request({ reviewed: true }), context)).status).toBe(404);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("does not accept an original Hero image as a Main deletion target", async () => {
    mocks.variant.mockResolvedValue({ id: "hero-1", productId: "product-1" });
    expect((await DELETE(request(), context)).status).toBe(404);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("deletes only the derived id, not its source", async () => {
    const response = await DELETE(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deletedImageIds: ["main-1"] });
    expect(mocks.remove).toHaveBeenCalledWith("main-1");
  });
});
