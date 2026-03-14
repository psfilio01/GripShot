import type { Product } from "../domain/product";
export type Bucket = "neutral" | "favorites" | "rejected" | "variants";
export interface StoreImageArgs {
    product: Product;
    jobId: string;
    bucket: Bucket;
    imageId: string;
    extension?: string;
    buffer: Buffer;
}
export declare function getGeneratedRoot(dataRoot: string): string;
export declare function storeImage(args: StoreImageArgs): Promise<string>;
export declare function moveImage(currentPath: string, targetBucket: Bucket, productId: string, jobId: string, imageId: string): Promise<string>;
//# sourceMappingURL=resultStorage.d.ts.map