export interface BackgroundReference {
    path: string;
}
/**
 * Loads the golden background reference image for AuréLéa.
 * Looks for data/brand/aurelea/backgrounds/golden.* (jpg, png, etc.).
 */
export declare function loadGoldenBackground(dataRoot: string): Promise<BackgroundReference | null>;
//# sourceMappingURL=backgroundLoader.d.ts.map