export type WorkflowType = "NEUTRAL_PRODUCT_SHOT" | "AMAZON_LIFESTYLE_SHOT";

/** Scene options for lifestyle shots (defaults: black Pilates outfit, barefoot, black mat). */
export interface SceneOptions {
  /** e.g. "short Pilates outfit in neutral black" */
  outfit?: string;
  /** Default true: model barefoot */
  barefoot?: boolean;
  /** e.g. "black exercise mat" */
  mat?: string;
}

export interface StartImageJobInput {
  productId: string;
  workflowType: WorkflowType;
  /** If not set, a random model from available references is chosen. */
  modelId?: string;
  /** Use the golden background reference image (AuréLéa). */
  useGoldenBackground?: boolean;
  /** Override defaults for outfit, barefoot, mat. Omitted = use AuréLéa defaults. */
  sceneOptions?: SceneOptions;
  /** If true, allow AI to adapt styling within brand DNA. */
  creativeFreedom?: boolean;
  /** Override aspect ratio (e.g. "4:5", "1:1", "16:9"). Falls back to runtime JSON or default. */
  aspectRatio?: string;
  /** Override resolution (e.g. "2K", "4K"). Falls back to runtime JSON or default. */
  resolution?: string;
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
