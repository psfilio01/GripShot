export interface Product {
    id: string;
    name?: string;
    /**
     * Root folder for this product, e.g. <DATA_ROOT>/products/pilates-mini-ball
     */
    basePath: string;
}
export declare function buildProductFromId(productId: string, dataRoot: string): Product;
//# sourceMappingURL=product.d.ts.map