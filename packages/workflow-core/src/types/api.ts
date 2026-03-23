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
  /** If not set, a random model is chosen (see allowedModelIds). */
  modelId?: string;
  /**
   * When set, random model selection is restricted to this id list only.
   * Empty array means no model reference images for lifestyle shots.
   * When omitted, falls back to scanning the filesystem under data/models/.
   */
  allowedModelIds?: string[];
  /** Use the golden background reference image (AuréLéa). */
  useGoldenBackground?: boolean;
  /** User-managed background id. When set, loads the background image from data/backgrounds/{id}/ */
  backgroundId?: string;
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
  /** Full prompt text used for generation (for logging/debugging). */
  promptText?: string;
  /** Number of reference images sent to Gemini. */
  referenceImageCount?: number;
}

export interface GetJobResultImage {
  imageId: string;
  status: "neutral" | "favorite" | "rejected" | "variant" | "hero_lock";
  filePath: string;
  colorVariant?: string | null;
  heroLockId?: string;
  colorLineage?: {
    parentVariantId: string;
    targetColorName: string;
    targetColorHex: string;
    generationMethod: string;
  };
}

export interface GetJobResult {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  images: GetJobResultImage[];
}

export type FeedbackAction = "favorite" | "reject" | "hero_lock";

export interface ProductColorDef {
  id: string;
  name: string;
  hex: string;
}

export interface FeedbackEvent {
  imageId: string;
  action: FeedbackAction;
  /** Required for hero_lock: the product colors to generate variants for. */
  targetColors?: ProductColorDef[];
}

export interface HandleFeedbackResult {
  updatedImage: GetJobResultImage | null;
  newJobIds: string[];
}
