import type { BuiltPrompt } from "../domain/prompt";
export interface GeneratedImage {
    buffer: Buffer;
    extension?: string;
}
export declare function generateImagesWithNanoBanana(prompt: BuiltPrompt, referenceImagePath: string): Promise<GeneratedImage[]>;
//# sourceMappingURL=imageGenerator.d.ts.map