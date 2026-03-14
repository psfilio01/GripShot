import type { Product } from "../domain/product";
export interface ReferenceImage {
    path: string;
}
export declare function loadReferenceImages(product: Product): Promise<ReferenceImage[]>;
//# sourceMappingURL=referenceImageLoader.d.ts.map