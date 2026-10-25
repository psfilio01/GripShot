import { nanoid } from "nanoid";
import type { SceneLock } from "../domain/sceneLock";
import { generateImagesWithNanoBanana } from "./imageGenerator";

export interface GenerateMainImageRequest {
  sourceImagePath: string;
  sceneLock: SceneLock;
  targetColorName?: string;
  targetColorHex?: string;
  signal?: AbortSignal;
}

export interface GeneratedMainImage {
  buffer: Buffer;
  extension: string;
}

/**
 * Uses the existing Scene Lock approach to preserve the product and contact
 * shadow while replacing the remaining background with Amazon white.
 */
export async function generateMainImageVariant(
  request: GenerateMainImageRequest,
): Promise<GeneratedMainImage> {
  const generated = await generateImagesWithNanoBanana(
    {
      id: nanoid(),
      templateId: "amazon-main-image-background",
      templateVersion: 1,
      workflowType: "MAIN_IMAGE",
      text: buildMainImagePrompt(request),
    },
    request.sourceImagePath,
    undefined,
    { signal: request.signal },
  );
  const first = generated[0];
  if (!first) throw new Error("Main image generation returned no image.");

  return {
    buffer: first.buffer,
    extension: first.extension?.toLowerCase() || "png",
  };
}

function buildMainImagePrompt(request: GenerateMainImageRequest): string {
  const colorInstruction = request.targetColorName
    ? `Change ONLY the product material color to ${request.targetColorName} (${request.targetColorHex ?? "specified target"}).`
    : "Do not change the product color.";
  const invariants = request.sceneLock.protectedInvariants.join(", ");
  return [
    "Create an Amazon-compliant MAIN product image by editing the supplied photograph.",
    colorInstruction,
    "Replace every background pixel outside the product and its contact shadow with a flat, uniform pure white background (#FFFFFF, RGB 255/255/255).",
    "PRESERVE the soft natural contact shadow directly beneath the product. Do not erase it, redraw it, move it or turn it into a hard cut-out shadow.",
    "Do not change, redraw or reinterpret the product. Preserve its exact silhouette, proportions, camera angle, crop, surface texture, seams, valve, embossed logo/text, highlights, reflections and fine details pixel-faithfully.",
    "Do not add props, text, borders, gradients, horizons or floor texture.",
    `Scene invariants: ${invariants || "all product and camera details"}.`,
  ].join("\n");
}
