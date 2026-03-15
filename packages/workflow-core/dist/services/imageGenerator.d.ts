import type { BuiltPrompt } from "../domain/prompt";
import type { GenerationSettings } from "./runtimeInputLoader";
export interface GeneratedImage {
    buffer: Buffer;
    extension?: string;
}
/** Ordered list of reference image paths (product, then optional background, then optional model). */
export type ReferenceImageInput = string | string[];
/**
 * Generate images via Gemini. Reference images are sent in order (product refs, optional background, optional model).
 * Single path or array of paths supported.
 */
export declare function generateImagesWithNanoBanana(prompt: BuiltPrompt, referenceImagePaths: ReferenceImageInput, generationSettings?: GenerationSettings): Promise<GeneratedImage[]>;
//# sourceMappingURL=imageGenerator.d.ts.map