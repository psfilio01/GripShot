import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  product: vi.fn(),
  variant: vi.fn(),
  quota: vi.fn(),
  pending: vi.fn(),
  running: vi.fn(),
  after: vi.fn(),
  run: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: mocks.after,
}));
vi.mock("@/lib/auth/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/db/products", () => ({ getProduct: mocks.product }));
vi.mock("@/lib/billing/quota", () => ({ checkQuota: mocks.quota }));
vi.mock("@/lib/db/pending-image-generations", () => ({
  createPendingImageGeneration: mocks.pending,
  hasRunningHeroColorRegeneration: mocks.running,
}));
vi.mock("@/lib/hero-lock/run-pending", () => ({ runPendingHeroLock: mocks.run }));
vi.mock("@fashionmentum/workflow-core", () => ({ metadataStore: { getVariantById: mocks.variant } }));

import { POST } from "./route";

const request = (body: unknown) => new NextRequest("http://localhost/api/hero-lock/regenerate", {
  method: "POST",
  body: JSON.stringify(body),
});

const source = {
  id: "rose-variant",
  productId: "product-1",
  status: "neutral",
  filePath: "/data/rose.png",
  colorLineage: {
    parentVariantId: "hero-master",
    targetColorName: "Soft Rose",
    targetColorHex: "#EAB0C3",
    generationMethod: "hero_lock_recolor",
    provenance: {
      rules: {
        policy: { allComponentsFollowTargetColor: true, instructions: "Valve follows target color." },
        targetColorNotes: "Valve must be rose, never black.",
        extractedRules: [],
      },
    },
  },
};
const master = { id: "hero-master", productId: "product-1", status: "hero_lock", filePath: "/data/master.png" };

describe("Hero color regeneration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" }, isAdmin: false });
    mocks.product.mockResolvedValue({ id: "product-1", deletedAt: null, colors: [] });
    mocks.variant.mockImplementation((id: string) => Promise.resolve(id === source.id ? source : master));
    mocks.quota.mockResolvedValue({ remaining: 3 });
    mocks.running.mockResolvedValue(false);
    mocks.pending.mockResolvedValue(undefined);
  });

  it("requires authentication and validates the image id", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ imageId: source.id }))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { workspaceId: "workspace-1" }, isAdmin: false });
    expect((await POST(request({ imageId: "../master" }))).status).toBe(400);
    expect(mocks.pending).not.toHaveBeenCalled();
  });

  it("retries one immutable color snapshot from its Hero master", async () => {
    expect((await POST(request({ imageId: source.id }))).status).toBe(202);
    expect(mocks.pending).toHaveBeenCalledWith("workspace-1", expect.any(String), expect.objectContaining({
      kind: "hero",
      expectedVariantCount: 1,
      heroMasterImageId: "hero-master",
      regeneratedFromImageId: source.id,
      heroColorName: "Soft Rose",
    }));
    await mocks.after.mock.calls[0][0]();
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({
      master: expect.objectContaining({ id: "hero-master" }),
      targetColors: [{ id: "retry-rose-variant", name: "Soft Rose", hex: "#EAB0C3", notes: "Valve must be rose, never black." }],
      recolorPolicy: { allComponentsFollowTargetColor: true, instructions: "Valve follows target color." },
      regeneratedFromVariantId: source.id,
    }));
  });

  it("rejects Main copies, missing masters, duplicate retries, and insufficient credits", async () => {
    mocks.variant.mockResolvedValueOnce({ ...source, mainImage: {} });
    expect((await POST(request({ imageId: source.id }))).status).toBe(400);

    mocks.variant.mockImplementation((id: string) => Promise.resolve(id === source.id ? source : null));
    expect((await POST(request({ imageId: source.id }))).status).toBe(409);

    mocks.variant.mockImplementation((id: string) => Promise.resolve(id === source.id ? source : master));
    mocks.running.mockResolvedValue(true);
    expect((await POST(request({ imageId: source.id }))).status).toBe(409);

    mocks.running.mockResolvedValue(false);
    mocks.quota.mockResolvedValue({ remaining: 0 });
    expect((await POST(request({ imageId: source.id }))).status).toBe(429);
  });
});
