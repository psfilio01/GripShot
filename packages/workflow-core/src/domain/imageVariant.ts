import type { ProductRecolorPolicy } from "../types/api";

export type ImageVariantStatus =
  | "neutral"
  | "favorite"
  | "rejected"
  | "variant"
  | "hero_lock";

export interface ColorLineage {
  parentVariantId: string;
  targetColorName: string;
  targetColorHex: string;
  generationMethod: "hero_lock_recolor";
  provenance?: RecolorProvenance;
}

/** Trace the exact source, image model, prompt and captured color settings of an edit. */
export interface RecolorProvenance {
  sourceSha256: string;
  imageModel: string;
  promptSha256: string;
  rulesSha256: string;
  rules: {
    policy: ProductRecolorPolicy;
    targetColorNotes: string;
    extractedRules: string[];
  };
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
  /** Set on derived color variants to trace lineage back to the master. */
  colorLineage?: ColorLineage;
  /** Independent, lossless white-background copy. Never mutates its source. */
  mainImage?: MainImageMetadata;
  /** Post-generation quality assessment. Present only when quality scoring is enabled. */
  qualityScore?: {
    overallScore: number;
    productVisible: boolean;
    proportionsPlausible: boolean;
    goalMet: boolean;
    issues: string[];
  };
}

export interface MainImageMetrics {
  version: string;
  model: string;
  modelSha256: string;
  sourceSha256: string;
  width: number;
  height: number;
  requiresReview: true;
  checks: { pureWhiteBackground: boolean; opaqueProductUnchanged: boolean };
  warnings: string[];
  [key: string]: unknown;
}

export interface MainImageMetadata {
  sourceVariantId: string;
  sourceSha256: string;
  preserveShadow: boolean;
  reviewed: boolean;
  reviewedAt?: string;
  metrics: MainImageMetrics;
}
