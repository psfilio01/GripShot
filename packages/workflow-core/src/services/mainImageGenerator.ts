import { nanoid } from "nanoid";
import type { SceneLock } from "../domain/sceneLock";
import { generateImagesWithNanoBanana } from "./imageGenerator";

// Keep this deliberately conservative: Gemini performs the background edit;
// this step only snaps already-near-white edge pixels to exact #FFFFFF. A
// lower threshold would clip the light outer falloff of contact shadows.
const LIGHT_BACKGROUND_MIN = 248;
const LIGHT_BACKGROUND_MAX_CHANNEL_SPREAD = 24;

export interface GenerateMainImageRequest {
  sourceImagePath: string;
  sceneLock: SceneLock;
  targetColorName?: string;
  targetColorHex?: string;
  signal?: AbortSignal;
}

export interface GeneratedMainImage {
  buffer: Buffer;
  extension: "png";
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
    buffer: await normalizeConnectedLightBackground(first.buffer),
    extension: "png",
  };
}

/**
 * Flood-fills only light, neutral pixels connected to the canvas edge and
 * writes them as exact #FFFFFF. Dark product pixels and the soft contact
 * shadow remain untouched.
 */
export async function normalizeConnectedLightBackground(
  buffer: Buffer,
): Promise<Buffer> {
  // Load the native image dependency only when this workflow runs. The core
  // package is shared by every API route, so an eager import would make all
  // routes load sharp during Next.js page-data collection.
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const isLightNeutral = (pixel: number) => {
    const offset = pixel * channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    return (
      Math.min(r, g, b) >= LIGHT_BACKGROUND_MIN &&
      Math.max(r, g, b) - Math.min(r, g, b) <=
        LIGHT_BACKGROUND_MAX_CHANNEL_SPREAD
    );
  };
  const enqueue = (pixel: number) => {
    if (visited[pixel] || !isLightNeutral(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++]!;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (!visited[pixel]) continue;
    const offset = pixel * channels;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
  }

  return sharp(data, { raw: info }).png().toBuffer();
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
