import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), product: vi.fn(), model: vi.fn(), background: vi.fn(),
  put: vi.fn(), register: vi.fn(), pending: vi.fn(), after: vi.fn(), quota: vi.fn(),
}));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/auth/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/products", () => ({ getProduct: mocks.product }));
vi.mock("@/lib/db/human-models", () => ({ getHumanModel: mocks.model }));
vi.mock("@/lib/db/backgrounds", () => ({ getBackground: mocks.background }));
vi.mock("@/lib/billing/quota", () => ({ checkQuota: mocks.quota }));
vi.mock("@/lib/db/pending-image-generations", () => ({
  createPendingImageGeneration: mocks.pending, deleteFailedPendingImageGenerationsForProduct: vi.fn(),
}));
vi.mock("@/lib/hero-lock/run-pending", () => ({ runPendingHeroLock: vi.fn() }));
vi.mock("@fashionmentum/workflow-core", () => ({
  usesGcsBlobStorage: () => true, putDataObject: mocks.put, getDataObjectBuffer: vi.fn().mockResolvedValue(null),
  registerExternalHeroMaster: mocks.register,
}));
import { POST as productPost } from "@/app/api/products/[productId]/images/route";
import { POST as modelPost } from "@/app/api/human-models/[modelId]/images/route";
import { POST as backgroundPost } from "@/app/api/backgrounds/[backgroundId]/upload/route";
import { POST as heroPost } from "@/app/api/hero-lock/upload/route";
import { MAX_IMAGE_UPLOAD_REQUEST_BYTES } from "./upload-limits";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6P90AAAAASUVORK5CYII=", "base64");
const routes = [
  { name: "product", field: "files", status: 200, post: (request: NextRequest) => productPost(request, { params: Promise.resolve({ productId: "product-1" }) }) },
  { name: "model", field: "files", status: 200, post: (request: NextRequest) => modelPost(request, { params: Promise.resolve({ modelId: "model-1" }) }) },
  { name: "background", field: "file", status: 200, post: (request: NextRequest) => backgroundPost(request, { params: Promise.resolve({ backgroundId: "background-1" }) }) },
  { name: "hero", field: "image", status: 202, post: heroPost },
];
const request = (field: string, bytes = png, duplicate = false) => {
  const body = new FormData();
  body.append(field, new File([bytes], "product.png", { type: "image/png" }));
  body.append("productId", "product-1");
  if (duplicate) body.append(field, new File([png], "another.png", { type: "image/png" }));
  return new NextRequest("http://localhost/upload", { method: "POST", body });
};

describe.each(routes)("$name image upload route", ({ field, status, post, name }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" }, isAdmin: true });
    mocks.product.mockResolvedValue({ id: "product-1", colors: [{ id: "rose", name: "Rose", hex: "#ffc0cb" }] });
    mocks.model.mockResolvedValue({ id: "model-1" });
    mocks.background.mockResolvedValue({ id: "background-1" });
    mocks.quota.mockResolvedValue({ remaining: 100 });
    mocks.register.mockResolvedValue({ id: "master-1" });
  });

  it("requires authentication before reading or writing images", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await post(request(field))).status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("accepts an image above the former 10 MiB limit and persists unchanged bytes", async () => {
    const bytes = Buffer.alloc(10 * 1024 * 1024 + 1);
    png.copy(bytes);
    expect((await post(request(field, bytes))).status).toBe(status);
    const stored: Buffer = name === "hero" ? mocks.register.mock.calls[0][0].buffer : mocks.put.mock.calls[0][1];
    expect(stored.equals(bytes)).toBe(true);
    // Never execute the scheduled generation during this upload-only test.
    expect(mocks.after).toHaveBeenCalledTimes(name === "hero" ? 1 : 0);
  });

  it("rejects multiple files without partial persistence", async () => {
    expect((await post(request(field, png, true))).status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.pending).not.toHaveBeenCalled();
  });

  it("rejects unsupported bytes and excessive pixel dimensions before writes", async () => {
    expect((await post(request(field, Buffer.from("not a png")))).status).toBe(400);
    const bytes = Buffer.from(png);
    bytes.writeUInt32BE(25000001, 16);
    expect((await post(request(field, bytes))).status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("rejects oversized HTTP payloads with 413", async () => {
    // A network request supplies a byte stream, not Undici's lazy FormData encoder.
    const req = new NextRequest("http://localhost/upload", {
      method: "POST", body: "unread", headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(MAX_IMAGE_UPLOAD_REQUEST_BYTES + 1),
      },
    });
    expect((await post(req)).status).toBe(413);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
