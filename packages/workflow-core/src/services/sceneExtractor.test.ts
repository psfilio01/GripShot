import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../config/env", () => ({ getEnv: () => ({ NANOBANANA_API_KEY: "test", NANOBANANA_BASE_URL: "https://example.test", NANOBANANA_DRY_RUN: false }) }));
vi.mock("./imageFileRead", () => ({ readImageFileForProcessing: vi.fn().mockResolvedValue({ buffer: Buffer.from("image"), ext: "png" }) }));
import axios from "axios";
import { extractSceneLock } from "./sceneExtractor";

describe("scene extraction color-rule scope", () => {
  beforeEach(() => vi.clearAllMocks());
  it("extracts scoped color facts in the existing analysis call, keeping broad instructions out of the edit", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
      protectedInvariants: ["geometry", "background"],
      recolorRules: ["Valve follows target color.", null, 123],
      detectedProductColor: "Black",
    }) }] } }] } });
    const scene = await extractSceneLock("/image.png", "hero", "ball", "HERO", undefined, {
      allComponentsFollowTargetColor: true,
      productInstructions: "Ventil folgt der Zielfarbe. Warmes Licht, grüne Wand.",
    });
    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(axios.post).mock.calls[0][1] as { contents: { parts: { text?: string }[] }[] };
    expect(payload.contents[0].parts[0].text).toContain("extract ONLY explicit product component/material color facts");
    expect(payload.contents[0].parts[0].text).toContain("Ignore lighting, backgrounds, camera");
    expect(payload.contents[0].parts[0].text).toContain("Ventil folgt der Zielfarbe");
    expect(scene.recolorRules).toEqual(["Valve follows target color."]);
  });

  it("preserves the original analysis prompt and schema for no-rule products", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
      protectedInvariants: ["black valve", "geometry"],
      recolorRules: ["invented material rule"],
      detectedProductColor: "Black",
    }) }] } }] } });
    const scene = await extractSceneLock("/image.png", "hero", "ball", "HERO", undefined, {
      allComponentsFollowTargetColor: false, instructions: "", productInstructions: "",
    });
    const payload = vi.mocked(axios.post).mock.calls[0][1] as { contents: { parts: { text?: string }[] }[]; generationConfig: { responseSchema: { properties: object } } };
    expect(payload.contents[0].parts[0].text).toBe("Analyze this product image in detail. Extract the scene composition, subject, product placement, camera framing, lighting, background, and the apparent product color. List the visual invariants that should be preserved if only the product color were to change. Be specific and precise.");
    expect(payload.generationConfig.responseSchema.properties).not.toHaveProperty("recolorRules");
    expect(scene.protectedInvariants).toEqual(["black valve", "geometry"]);
    expect(scene.recolorRules).toBeUndefined();
  });
});
