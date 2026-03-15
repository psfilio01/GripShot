/**
 * Runtime input from OpenClaw (or manual execution).
 * All fields are optional; present values are layered into the prompt.
 */
export interface RuntimeInput {
    pose?: string;
    gaze?: string;
    outfit?: string;
    feet_style?: string;
    background_style?: string;
    composition_goal?: string;
    mood?: string;
    framing?: string;
    extra?: string;
    [key: string]: string | undefined;
}
declare const ALLOWED_RESOLUTIONS: readonly ["512", "1K", "2K", "4K"];
declare const ALLOWED_ASPECT_RATIOS: readonly ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];
export type ImageResolution = (typeof ALLOWED_RESOLUTIONS)[number];
export type AspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];
export interface GenerationSettings {
    resolution: ImageResolution;
    aspectRatio: AspectRatio;
}
export interface RuntimeLoadResult {
    input: RuntimeInput | null;
    generationSettings: GenerationSettings;
}
/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns prompt-level fields in `input` and generation settings (with defaults) in `generationSettings`.
 */
export declare function loadRuntimeInput(dataRoot: string): Promise<RuntimeLoadResult>;
export {};
//# sourceMappingURL=runtimeInputLoader.d.ts.map