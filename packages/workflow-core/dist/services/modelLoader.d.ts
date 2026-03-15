export interface ModelReference {
    path: string;
}
/**
 * Lists all model IDs (subfolders of data/models/ that contain a reference/ folder with images).
 */
export declare function listModels(dataRoot: string): Promise<string[]>;
/**
 * Loads reference image paths for a given model.
 */
export declare function loadModelReferences(dataRoot: string, modelId: string): Promise<ModelReference[]>;
/**
 * Picks a random model ID from available models, or undefined if none.
 */
export declare function pickRandomModelId(modelIds: string[]): string | undefined;
//# sourceMappingURL=modelLoader.d.ts.map