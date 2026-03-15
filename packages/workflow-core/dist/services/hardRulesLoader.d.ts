import type { Product } from "../domain/product";
export interface HardRules {
    /** Markdown text with non-negotiable constraints. */
    text: string;
    source: "global" | "product";
}
/**
 * Load global brand hard rules from data/brand/aurelea/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
export declare function loadGlobalHardRules(dataRoot: string): Promise<HardRules | null>;
/**
 * Load product-specific hard rules from data/products/<id>/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
export declare function loadProductHardRules(product: Product): Promise<HardRules | null>;
//# sourceMappingURL=hardRulesLoader.d.ts.map