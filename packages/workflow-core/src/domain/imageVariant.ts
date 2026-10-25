export type ImageVariantStatus =
  | "neutral"
  | "favorite"
  | "rejected"
  | "variant"
  | "hero_lock"
  | "main_image"
  | "main_source";

export interface ColorLineage {
  parentVariantId: string;
  targetColorName: string;
  targetColorHex: string;
  generationMethod: "hero_lock_recolor" | "main_image_recolor";
}

export interface ImageVariant {
  id: string;
  jobId: string;
  productId: string;
  status: ImageVariantStatus;
  filePath: string;
  colorVariant?: string | null;
  createdAt: string;
  /** Set when this variant is the hero-locked master for color expansion. */
  heroLockId?: string;
  /** Set on an Amazon-compliant white-background master. */
  mainImageId?: string;
  /** Internal source uploaded only for a background Main-image run. */
  temporarySource?: boolean;
  /** Set on derived color variants to trace lineage back to the master. */
  colorLineage?: ColorLineage;
  /** Post-generation quality assessment. Present only when quality scoring is enabled. */
  qualityScore?: {
    overallScore: number;
    productVisible: boolean;
    proportionsPlausible: boolean;
    goalMet: boolean;
    issues: string[];
  };
}
