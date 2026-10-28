import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), product: vi.fn(), variant: vi.fn(), pending: vi.fn(), after: vi.fn(), run: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/auth/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/products", () => ({ getProduct: mocks.product }));
vi.mock("@/lib/db/pending-image-generations", () => ({ createPendingImageGeneration: mocks.pending }));
vi.mock("@/lib/main-image/run-pending", () => ({ runPendingMainImage: mocks.run }));
vi.mock("@fashionmentum/workflow-core", () => ({ metadataStore: { getVariantById: mocks.variant } }));
import { POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/main-image", { method: "POST", body: JSON.stringify(body) });
describe("Main submission authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" } });
    mocks.variant.mockResolvedValue({ id: "source-1", productId: "product-1" });
    mocks.product.mockResolvedValue({ id: "product-1", deletedAt: null });
  });
  it("requires authentication", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ imageId: "source-1" }))).status).toBe(401);
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it("rejects paths and browser-controlled source files", async () => {
    expect((await POST(request({ imageId: "../source" }))).status).toBe(400);
    expect((await POST(request({ imageId: "source-1", filePath: "/secret" }))).status).toBe(400);
  });
  it("requires source product to belong to the authenticated workspace", async () => {
    mocks.product.mockResolvedValue(null);
    expect((await POST(request({ imageId: "source-1" }))).status).toBe(404);
    expect(mocks.product).toHaveBeenCalledWith("workspace-1", "product-1");
    expect(mocks.pending).not.toHaveBeenCalled();
  });
  it("queues a CPU-only run with shadow preservation by default", async () => {
    expect((await POST(request({ imageId: "source-1" }))).status).toBe(202);
    expect(mocks.pending).toHaveBeenCalledWith("workspace-1", expect.any(String), expect.objectContaining({ kind: "main", mainSourceImageId: "source-1" }));
    await mocks.after.mock.calls[0][0]();
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ sourceImageId: "source-1", preserveShadow: true }));
  });
  it("rejects nested Main copies and deleted products", async () => {
    mocks.variant.mockResolvedValue({ id: "main-1", productId: "product-1", mainImage: {} });
    expect((await POST(request({ imageId: "main-1" }))).status).toBe(400);
    mocks.product.mockResolvedValue({ deletedAt: "deleted" });
    expect((await POST(request({ imageId: "main-1" }))).status).toBe(404);
  });
});
