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
    /** Arbitrary extra prompt hints that don't fit a named field. */
    extra?: string;
    /** Allow future fields without breaking the loader. */
    [key: string]: string | undefined;
}
/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns null if the file doesn't exist — the app falls back to defaults.
 */
export declare function loadRuntimeInput(dataRoot: string): Promise<RuntimeInput | null>;
//# sourceMappingURL=runtimeInputLoader.d.ts.map