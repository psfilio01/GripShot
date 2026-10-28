import { describe, expect, it } from "vitest";
import { buildRecolorPrompt, buildRecolorProvenance } from "./recolorGenerator";
import type { SceneLock } from "../domain/sceneLock";

const sceneLock: SceneLock = {
  sourceAssetId: "hero", productId: "ball", outputType: "HERO",
  sceneDescription: "Studio", subjectDescription: "Ball", productPlacement: "Center",
  compositionNotes: "Centered", cameraFraming: "Front", lightingNotes: "Soft",
  backgroundNotes: "White", protectedInvariants: ["black valve insert", "ball geometry"],
  recolorRules: ["Valve material follows the target color."],
  editableTargetFields: ["productColor"], detectedProductColor: "Black", extractedAt: "2026-01-01",
};

describe("recolor prompt component rules", () => {
  it("overrides inferred original component colors while keeping holes, scene and shadow", () => {
    const prompt = buildRecolorPrompt({
      masterImagePath: "/master.png", sceneLock,
      targetColorName: "Soft Rosé", targetColorHex: "#F4AABB",
      recolorPolicy: { allComponentsFollowTargetColor: true, instructions: "No black valve insert.", productInstructions: "Change the camera and background." },
      targetColorNotes: "Valve rim also Soft Rosé.",
    });
    expect(prompt).toContain("Every visible physical product component");
    expect(prompt).toContain("override inferred original colors only for the components they name");
    expect(prompt).toContain("preserve dark cavity/air-hole shadows");
    expect(prompt).toContain("Do not paint over, fill in, remove or redesign an opening");
    expect(prompt).toContain("Valve material follows the target color.");
    expect(prompt).toContain("Valve rim also Soft Rosé.");
    expect(prompt).toContain("background, composition, and framing must not change");
    expect(prompt).not.toContain("Change the camera and background.");
  });

  it("retains the original edit instructions when no correction rules are configured", () => {
    const prompt = buildRecolorPrompt({
      masterImagePath: "/master.png",
      sceneLock: { ...sceneLock, recolorRules: undefined },
      targetColorName: "White", targetColorHex: "#FFFFFF",
      recolorPolicy: { allComponentsFollowTargetColor: false, instructions: "", productInstructions: "" },
    });
    expect(prompt).toBe([
      "Edit this product image to change ONLY the product color from Black to White (#FFFFFF).",
      "",
      "CRITICAL INVARIANTS — do NOT change any of the following:",
      "- black valve insert, ball geometry",
      "- The product shape, size, texture, and surface finish must remain identical",
      "- The model's pose, expression, clothing, and position must be exactly the same",
      "- The lighting direction, warmth, and shadow pattern must be preserved",
      "- The background, composition, and framing must not change at all",
      "- Any logos, text, or branding on the product must stay in the same position",
      "",
      "ONLY the product material/surface color should change to:",
      "Color: White",
      "Hex: #FFFFFF",
      "",
      "The result should look like the exact same photograph taken of the exact same scene,",
      "but with the product manufactured in a different color.",
    ].join("\n"));
    expect(prompt).not.toContain("COLOR RULE SCOPE");
    expect(prompt).not.toContain("Do not retain an inferred black plastic insert");
  });

  it("does not forward unrelated general image instructions without extracted color facts", () => {
    const prompt = buildRecolorPrompt({
      masterImagePath: "/master.png", sceneLock: { ...sceneLock, recolorRules: [] },
      targetColorName: "White", targetColorHex: "#FFFFFF",
      recolorPolicy: { productInstructions: "Warm lighting and a blue background." },
    });
    expect(prompt).not.toContain("COLOR RULE SCOPE");
    expect(prompt).not.toContain("Warm lighting and a blue background.");
  });

  it("captures source, model, prompt and immutable rule provenance", () => {
    const request = { masterImagePath: "/master.png", sceneLock, targetColorName: "White", targetColorHex: "#FFFFFF", recolorPolicy: { instructions: "Valve follows body." } };
    const provenance = buildRecolorProvenance(request, Buffer.from("source-one"), "image-model", buildRecolorPrompt(request));
    const changed = buildRecolorProvenance(request, Buffer.from("source-two"), "image-model", "different prompt");
    expect(provenance.sourceSha256).not.toBe(changed.sourceSha256);
    expect(provenance.promptSha256).not.toBe(changed.promptSha256);
    expect(provenance.rulesSha256).toBe(changed.rulesSha256);
    request.recolorPolicy.instructions = "changed";
    expect(provenance.rules.policy.instructions).toBe("Valve follows body.");
    expect(provenance.imageModel).toBe("image-model");
  });
});
