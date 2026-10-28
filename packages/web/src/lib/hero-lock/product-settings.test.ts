import { describe, expect, it } from "vitest";
import { snapshotProductRecolorSettings } from "./product-settings";

describe("snapshotProductRecolorSettings", () => {
  it("snapshots authoritative selected colors, notes and unabridged product facts", () => {
    const product = {
      colors: [
        { id: "white", name: "White", hex: "#FFFFFF", notes: " White valve, natural hole shadow. " },
        { id: "pink", name: "Soft Rosé", hex: "#F4AABB" },
      ],
      recolorAllComponents: true,
      recolorInstructions: " No black valve insert. ",
      userPromptBlockRaw: "Ventil folgt der Zielfarbe. Warmes Licht.",
      userPromptBlockCompiled: "Use warm lighting.",
    };
    const snapshot = snapshotProductRecolorSettings(product, ["white"]);
    expect(snapshot).toEqual({
      targetColors: [{ id: "white", name: "White", hex: "#FFFFFF", notes: "White valve, natural hole shadow." }],
      recolorPolicy: {
        allComponentsFollowTargetColor: true,
        instructions: "No black valve insert.",
        productInstructions: "Ventil folgt der Zielfarbe. Warmes Licht.",
      },
    });
    product.colors[0].notes = "different";
    product.recolorInstructions = "different";
    expect(snapshot.targetColors[0].notes).toBe("White valve, natural hole shadow.");
    expect(snapshot.recolorPolicy.instructions).toBe("No black valve insert.");
  });

  it("rejects ids outside the product instead of accepting client-supplied color data", () => {
    expect(() => snapshotProductRecolorSettings({ colors: [] }, ["foreign"])).toThrow("no longer belongs");
  });

  it("supports legacy compiled instructions and products without recolor settings", () => {
    expect(snapshotProductRecolorSettings({ userPromptBlockCompiled: "Valve matches body." }).recolorPolicy)
      .toEqual({ allComponentsFollowTargetColor: false, instructions: "", productInstructions: "Valve matches body." });
  });
});
