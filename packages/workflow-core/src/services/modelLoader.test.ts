import { describe, it, expect } from "vitest";
import { resolveChosenModelId, pickRandomModelId } from "./modelLoader";

describe("resolveChosenModelId", () => {
  it("uses explicit model id when provided", () => {
    expect(
      resolveChosenModelId("model-a", ["model-b"], ["model-c"]),
    ).toBe("model-a");
  });

  it("trims explicit model id", () => {
    expect(resolveChosenModelId("  model-a  ", [], [])).toBe("model-a");
  });

  it("picks from allowed pool when no explicit id", () => {
    const pool = ["a", "b", "c"];
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = resolveChosenModelId(undefined, pool, ["x", "y"]);
      expect(pool).toContain(id);
      if (id) seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("returns undefined when allowed pool is empty", () => {
    expect(resolveChosenModelId(undefined, [], ["x"])).toBeUndefined();
  });

  it("falls back to filesystem list when pool undefined", () => {
    const fsIds = ["fs1", "fs2"];
    const id = resolveChosenModelId(undefined, undefined, fsIds);
    expect(fsIds).toContain(id!);
  });

  it("pickRandomModelId returns undefined for empty", () => {
    expect(pickRandomModelId([])).toBeUndefined();
  });
});
