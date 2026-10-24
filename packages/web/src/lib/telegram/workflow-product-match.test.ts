import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("workflow-product-match", () => {
  const prevDry = process.env.GEMINI_DRY_RUN;
  const prevKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_DRY_RUN = "true";
    process.env.GEMINI_API_KEY = "test-key-not-used-in-dry-run";
  });

  afterEach(() => {
    process.env.GEMINI_DRY_RUN = prevDry;
    process.env.GEMINI_API_KEY = prevKey;
    vi.resetModules();
  });

  it("dry run returns first catalog product id", async () => {
    const { matchProductForWorkflow } = await import("./workflow-product-match");
    const id = await matchProductForWorkflow("anything", [
      { id: "p-a", name: "Alpha" },
      { id: "p-b", name: "Beta" },
    ]);
    expect(id).toBe("p-a");
  });

  it("returns null for empty catalog", async () => {
    const { matchProductForWorkflow } = await import("./workflow-product-match");
    const id = await matchProductForWorkflow("x", []);
    expect(id).toBeNull();
  });
});
