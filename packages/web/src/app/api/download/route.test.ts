import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ session: vi.fn(), products: vi.fn(), jobs: vi.fn(), variants: vi.fn(), gcs: vi.fn(), getBlob: vi.fn(), append: vi.fn(), read: vi.fn(), exists: vi.fn() }));
vi.mock("@/lib/auth/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/products", () => ({ listProducts: mocks.products }));
vi.mock("@fashionmentum/workflow-core", () => ({ metadataStore: { listJobs: mocks.jobs, listVariantsForJob: mocks.variants }, usesGcsBlobStorage: mocks.gcs, getDataObjectBuffer: mocks.getBlob }));
vi.mock("fs", async (importOriginal) => ({ ...await importOriginal<typeof import("fs")>(), existsSync: mocks.exists }));
vi.mock("fs/promises", async (importOriginal) => ({ ...await importOriginal<typeof import("fs/promises")>(), readFile: mocks.read }));
vi.mock("archiver", () => ({ default: () => {
  const archive = new EventEmitter();
  return Object.assign(archive, {
    append: mocks.append,
    finalize: () => queueMicrotask(() => { archive.emit("data", Buffer.from("zip-data")); archive.emit("end"); }),
  });
} }));
import { POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/download", { method: "POST", body: JSON.stringify(body) });
const variants = [
  { id: "main-1", status: "neutral", filePath: "generated/product-1/main-job/neutral/main-1.png", mainImage: { reviewed: false } },
  { id: "main-2", status: "neutral", filePath: "generated/product-1/main-job/neutral/main-2.png", mainImage: { reviewed: true } },
  { id: "hero-1", status: "hero_lock", filePath: "generated/product-1/main-job/favorites/hero-1.png" },
];

describe("ZIP exact image selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" } });
    mocks.products.mockResolvedValue([{ id: "product-1" }]);
    mocks.jobs.mockResolvedValue([{ id: "own-job", productId: "product-1" }, { id: "other-job", productId: "product-2" }]);
    mocks.variants.mockImplementation(async (id: string) => id === "own-job" ? variants : [{ id: "private-1", status: "neutral", filePath: "generated/product-2/other-job/neutral/private-1.png" }]);
    mocks.gcs.mockReturnValue(true);
    mocks.getBlob.mockImplementation(async (path: string) => Buffer.from(path));
    mocks.read.mockResolvedValue(Buffer.from("local-image"));
    mocks.exists.mockReturnValue(true);
  });

  it("archives exactly the visible requested Main ids, not every neutral image", async () => {
    const response = await POST(request({ imageIds: ["main-2"] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(mocks.append).toHaveBeenCalledTimes(1);
    expect(mocks.append).toHaveBeenCalledWith(Buffer.from(variants[1].filePath), { name: "product-1-main-2.png" });
    expect(mocks.getBlob).not.toHaveBeenCalledWith(variants[0].filePath);
  });

  it("excludes foreign workspace jobs even when their ids are explicitly requested", async () => {
    const response = await POST(request({ imageIds: ["main-1", "private-1"] }));
    expect(response.status).toBe(200);
    expect(mocks.products).toHaveBeenCalledWith("workspace-1");
    expect(mocks.variants).not.toHaveBeenCalledWith("other-job");
    expect(mocks.append).toHaveBeenCalledTimes(1);
    const foreignOnly = await POST(request({ imageIds: ["private-1"] }));
    expect(foreignOnly.status).toBe(404);
  });

  it("rejects empty/oversized/malformed selections and malformed JSON", async () => {
    for (const body of [{ imageIds: [] }, { imageIds: Array(501).fill("main-1") }, { imageIds: ["../secret"] }, { imageIds: "main-1" }, { productId: "x\r\nheader" }, { status: "main" }, { filePath: "/secret" }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    const invalidJson = new NextRequest("http://localhost/api/download", { method: "POST", body: "{" });
    expect((await POST(invalidJson)).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("requires authentication before any source lookup", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ imageIds: ["main-1"] }))).status).toBe(401);
    expect(mocks.jobs).not.toHaveBeenCalled();
  });

  it("applies status/product restrictions and deduplicates requested ids", async () => {
    expect((await POST(request({ imageIds: ["hero-1", "main-1", "main-1"], status: "neutral", productId: "product-1" }))).status).toBe(200);
    expect(mocks.append).toHaveBeenCalledTimes(1);
    expect(mocks.append.mock.calls[0][1].name).toBe("product-1-main-1.png");
    expect((await POST(request({ imageIds: ["main-1"], productId: "product-2" }))).status).toBe(404);
  });

  it("does not confuse a sibling directory with the allowed local data root", async () => {
    const previous = process.env.WORKFLOW_DATA_ROOT;
    process.env.WORKFLOW_DATA_ROOT = "/safe/data";
    try {
      mocks.gcs.mockReturnValue(false);
      mocks.variants.mockResolvedValue([{ ...variants[0], filePath: "/safe/data-private/secret.png" }]);
      expect((await POST(request({ imageIds: ["main-1"] }))).status).toBe(404);
      expect(mocks.read).not.toHaveBeenCalled();
      mocks.variants.mockResolvedValue([{ ...variants[0], filePath: "generated/product-1/main.png" }]);
      expect((await POST(request({ imageIds: ["main-1"] }))).status).toBe(200);
      expect(mocks.read).toHaveBeenCalledWith("/safe/data/generated/product-1/main.png");
    } finally {
      if (previous === undefined) delete process.env.WORKFLOW_DATA_ROOT;
      else process.env.WORKFLOW_DATA_ROOT = previous;
    }
  });
});
