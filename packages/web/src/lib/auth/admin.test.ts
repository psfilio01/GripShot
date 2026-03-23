import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminUid } from "./admin";

describe("isAdminUid", () => {
  const originalEnv = process.env.ADMIN_UIDS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_UIDS = originalEnv;
    } else {
      delete process.env.ADMIN_UIDS;
    }
    // Force cache invalidation by resetting the module
  });

  it("returns false when ADMIN_UIDS is not set", async () => {
    delete process.env.ADMIN_UIDS;
    const mod = await import("./admin");
    expect(mod.isAdminUid("some-uid")).toBe(false);
  });

  it("returns false when ADMIN_UIDS is empty", async () => {
    process.env.ADMIN_UIDS = "";
    const mod = await import("./admin");
    expect(mod.isAdminUid("some-uid")).toBe(false);
  });
});
