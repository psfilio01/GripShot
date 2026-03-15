export interface BrandDna {
    brandId: string;
    brandName: string;
    /** Full DNA text for prompt injection */
    text: string;
}
/**
 * Loads brand DNA from data/brand/{brandId}/dna.md.
 * Falls back to empty text if file is missing (e.g. for tests).
 */
export declare function loadBrandDna(dataRoot: string, brandId?: string): Promise<BrandDna>;
//# sourceMappingURL=brandDnaLoader.d.ts.map