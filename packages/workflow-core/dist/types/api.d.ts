export type WorkflowType = "NEUTRAL_PRODUCT_SHOT";
export interface StartImageJobInput {
    productId: string;
    workflowType: WorkflowType;
}
export interface StartImageJobResult {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
}
export interface GetJobResultImage {
    imageId: string;
    status: "neutral" | "favorite" | "rejected" | "variant";
    filePath: string;
    colorVariant?: string | null;
}
export interface GetJobResult {
    jobId: string;
    status: "pending" | "running" | "completed" | "failed";
    images: GetJobResultImage[];
}
export type FeedbackAction = "favorite" | "reject" | "generate_all_colors";
export interface FeedbackEvent {
    imageId: string;
    action: FeedbackAction;
}
export interface HandleFeedbackResult {
    updatedImage: GetJobResultImage | null;
    newJobIds: string[];
}
//# sourceMappingURL=api.d.ts.map