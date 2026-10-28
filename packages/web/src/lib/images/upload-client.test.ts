import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadImagesSequentially } from "./upload-client";
import { MAX_IMAGE_UPLOAD_BYTES } from "./upload-limits";

describe("multi-select image uploads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends exactly one file and metadata per request, sequentially", async () => {
    let active = 0;
    const fetch = vi.fn(async (_url, options) => {
      expect(active++).toBe(0);
      await Promise.resolve();
      expect(options.body.getAll("files")).toHaveLength(1);
      expect(options.body.get("category")).toBe("primary");
      active -= 1;
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    await uploadImagesSequentially("/upload", [new File(["a"], "a.png"), new File(["b"], "b.png")], { category: "primary" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized selection before any uploads", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(uploadImagesSequentially("/upload", [new File(["a"], "a.png"), { name: "large.png", size: MAX_IMAGE_UPLOAD_BYTES + 1 } as File])).rejects.toThrow("25 MB");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports partial success accurately and stops after an error", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Invalid image" }), { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    await expect(uploadImagesSequentially("/upload", ["a", "b", "c"].map((name) => new File(["x"], name)))).rejects.toThrow("Invalid image (1/3 images uploaded.)");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
