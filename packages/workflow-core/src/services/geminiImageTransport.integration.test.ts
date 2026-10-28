import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: {
  post: vi.fn(), get: vi.fn(), delete: vi.fn(), isAxiosError: () => false, isCancel: () => false,
} }));
vi.mock("../config/env", () => ({ getEnv: () => ({
  NANOBANANA_API_KEY: "test-key", NANOBANANA_BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
  NANOBANANA_MODEL: "gemini-nano-banana-2.1", NANOBANANA_DRY_RUN: false,
}) }));
vi.mock("./imageFileRead", () => ({ readImageFileForProcessing: vi.fn() }));
import axios from "axios";
import { readImageFileForProcessing } from "./imageFileRead";
import { generateImagesWithNanoBanana } from "./imageGenerator";
import { extractSceneLock } from "./sceneExtractor";
import { buildRecolorPrompt, generateRecolorVariant, type RecolorRequest } from "./recolorGenerator";
import { GEMINI_INLINE_REQUEST_BUDGET } from "./geminiImageTransport";
import type { BuiltPrompt } from "../domain/prompt";

const base = "https://generativelanguage.googleapis.com/v1beta";
const prompt = { text: "Keep the original composition." } as BuiltPrompt;
const recolor: RecolorRequest = {
  masterImagePath: "/master.png", targetColorName: "White", targetColorHex: "#ffffff", aspectRatio: "1:1",
  sceneLock: {
    sourceAssetId: "hero", productId: "ball", outputType: "HERO", sceneDescription: "Studio", subjectDescription: "Ball",
    productPlacement: "Center", compositionNotes: "Centered", cameraFraming: "Front", lightingNotes: "Soft",
    backgroundNotes: "White", protectedInvariants: ["ball geometry"], editableTargetFields: ["productColor"],
    detectedProductColor: "Black", extractedAt: "2026-01-01",
  },
};
let names: string[];
let generatedRequests: any[];
let imageResponses: any[];
let generationError: Error | undefined;

describe("large-image transport in every Gemini pipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    names = [];
    generatedRequests = [];
    generationError = undefined;
    imageResponses = [{ data: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from("generated").toString("base64") } }] } }] } }];
    vi.mocked(readImageFileForProcessing).mockResolvedValue({ buffer: Buffer.alloc(13 * 1024 * 1024), ext: "png" });
    vi.mocked(axios.delete).mockResolvedValue({});
    vi.mocked(axios.post).mockImplementation(async (url, body) => {
      if (url === "https://generativelanguage.googleapis.com/upload/v1beta/files") {
        names.push(body.file.name);
        return { headers: { "x-goog-upload-url": `https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=${names.length}` } };
      }
      if (Buffer.isBuffer(body)) {
        return { data: { file: { name: names.at(-1), uri: `${base}/${names.at(-1)}`, state: "ACTIVE" } } };
      }
      generatedRequests.push(body);
      expect(axios.delete).not.toHaveBeenCalled();
      expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(GEMINI_INLINE_REQUEST_BUDGET);
      if (generationError) throw generationError;
      return url.includes("gemini-2.5-flash")
        ? { data: { candidates: [{ content: { parts: [{ text: JSON.stringify({ protectedInvariants: ["geometry"], detectedProductColor: "Black" }) }] } }] } }
        : imageResponses.shift();
    });
  });

  it("extracts scenes using a temporary file and preserves the original scene prompt/schema", async () => {
    const scene = await extractSceneLock("/hero.png", "hero", "ball", "HERO");
    expect(scene.detectedProductColor).toBe("Black");
    const body = generatedRequests[0];
    expect(body.contents[0].parts[0].text).toBe("Analyze this product image in detail. Extract the scene composition, subject, product placement, camera framing, lighting, background, and the apparent product color. List the visual invariants that should be preserved if only the product color were to change. Be specific and precise.");
    expect(body.contents[0].parts[1]).toHaveProperty("file_data");
    expect(body.generationConfig.responseSchema.properties).not.toHaveProperty("recolorRules");
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it("recolors from unchanged original bytes with identical prompt/config and source provenance", async () => {
    const result = await generateRecolorVariant(recolor);
    expect(result.buffer.toString()).toBe("generated");
    expect(result.provenance?.sourceSha256).toHaveLength(64);
    expect(generatedRequests[0].contents[0].parts[0].text).toBe(buildRecolorPrompt(recolor));
    expect(generatedRequests[0].contents[0].parts[1]).toHaveProperty("file_data");
    expect(generatedRequests[0].generationConfig).toEqual({ responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } });
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it("bounds aggregate product/background/model references while retaining their order", async () => {
    const originals = [9, 8, 1].map(size => Buffer.alloc(size * 1024 * 1024, size));
    originals.forEach(buffer => vi.mocked(readImageFileForProcessing).mockResolvedValueOnce({ buffer, ext: "png" }));
    const result = await generateImagesWithNanoBanana(prompt, ["/product.png", "/background.png", "/model.png"], { aspectRatio: "1:1", resolution: "2K" });
    expect(result[0].buffer.toString()).toBe("generated");
    const parts = generatedRequests[0].contents[0].parts;
    expect(parts[0]).toEqual({ text: prompt.text });
    expect(parts[1]).toHaveProperty("file_data");
    expect(parts[2].inline_data.data).toBe(originals[1].toString("base64"));
    expect(parts[3].inline_data.data).toBe(originals[2].toString("base64"));
    expect(names).toHaveLength(1);
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it("reuses uploaded references across existing generation retries, cleaning only after the last attempt", async () => {
    imageResponses.unshift({ data: { candidates: [{ content: { parts: [{ text: "No image" }] } }] } });
    await generateImagesWithNanoBanana(prompt, "/hero.png");
    expect(generatedRequests).toHaveLength(2);
    expect(generatedRequests[0].contents).toEqual(generatedRequests[1].contents);
    expect(names).toHaveLength(1);
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it.each(["scene", "recolor", "generation"])("cleans files after %s model-call failure", async (pipeline) => {
    generationError = new Error("Model unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const task = pipeline === "scene"
      ? extractSceneLock("/hero.png", "hero", "ball", "HERO")
      : pipeline === "recolor" ? generateRecolorVariant(recolor) : generateImagesWithNanoBanana(prompt, "/hero.png");
    await expect(task).rejects.toBe(generationError);
    expect(axios.delete).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
