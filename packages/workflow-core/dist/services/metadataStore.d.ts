import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";
export declare const metadataStore: {
    insertJob(job: ImageJob): Promise<void>;
    updateJobStatus(jobId: string, status: ImageJob["status"]): Promise<void>;
    getJob(jobId: string): Promise<ImageJob | null>;
    insertVariant(variant: ImageVariant): Promise<void>;
    updateVariantStatus(variantId: string, status: ImageVariant["status"]): Promise<void>;
    listVariantsForJob(jobId: string): Promise<ImageVariant[]>;
    getVariantById(id: string): Promise<ImageVariant | null>;
};
//# sourceMappingURL=metadataStore.d.ts.map