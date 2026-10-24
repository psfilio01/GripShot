import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import {
  upscaleImage,
  upscaledPath,
  isUpscalerAvailable,
  _resetBinaryCache,
  checkUpscalerOnStartup,
} from "./imageUpscaler";
import { _resetEnvCache } from "../config/env";

describe("upscaledPath", () => {
  it("appends -4k before the extension", () => {
    expect(upscaledPath("generated/abc/img.png")).toBe("generated/abc/img-4k.png");
  });

  it("works with nested paths", () => {
    expect(upscaledPath("/data/products/shot.jpeg")).toBe("/data/products/shot-4k.jpeg");
  });

  it("handles no extension", () => {
    expect(upscaledPath("file")).toBe("file-4k");
  });
});

describe("upscaleImage (dry-run)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `upscaler-test-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
    _resetBinaryCache();
    _resetEnvCache();
    process.env.NANOBANANA_DRY_RUN = "true";
  });

  afterEach(() => {
    delete process.env.NANOBANANA_DRY_RUN;
    _resetBinaryCache();
    _resetEnvCache();
    try {
      const files = require("fs").readdirSync(tmpDir);
      for (const f of files) unlinkSync(join(tmpDir, f));
      rmdirSync(tmpDir);
    } catch { /* cleanup best-effort */ }
  });

  it("copies input to output in dry-run mode", async () => {
    const inputPath = join(tmpDir, "input.png");
    const outputPath = join(tmpDir, "output-4k.png");
    const content = Buffer.from("fake-image-data");
    writeFileSync(inputPath, content);

    const result = await upscaleImage(inputPath, outputPath);

    expect(result.dryRun).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath).equals(content)).toBe(true);
  });

  it("isUpscalerAvailable returns true in dry-run", () => {
    expect(isUpscalerAvailable()).toBe(true);
  });
});

describe("upscaleImage (binary not found)", () => {
  beforeEach(() => {
    _resetBinaryCache();
    _resetEnvCache();
    delete process.env.NANOBANANA_DRY_RUN;
    delete process.env.REALESRGAN_BIN;
  });

  afterEach(() => {
    _resetBinaryCache();
    _resetEnvCache();
  });

  it("throws when binary is missing and not in dry-run", async () => {
    const tmpDir = join(tmpdir(), `upscaler-nobin-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
    const inputPath = join(tmpDir, "in.png");
    writeFileSync(inputPath, Buffer.from("fake"));
    try {
      await expect(
        upscaleImage(inputPath, join(tmpDir, "out.png")),
      ).rejects.toThrow("Real-ESRGAN binary not found");
    } finally {
      try { unlinkSync(inputPath); } catch { /* ok */ }
      try { rmdirSync(tmpDir); } catch { /* ok */ }
    }
  });
});

describe("checkUpscalerOnStartup", () => {
  beforeEach(() => {
    _resetBinaryCache();
    _resetEnvCache();
  });

  afterEach(() => {
    _resetBinaryCache();
    _resetEnvCache();
    delete process.env.NANOBANANA_DRY_RUN;
  });

  it("logs dry-run message when DRY_RUN is set", () => {
    process.env.NANOBANANA_DRY_RUN = "true";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    checkUpscalerOnStartup();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Dry-run mode"),
    );
    spy.mockRestore();
  });
});
